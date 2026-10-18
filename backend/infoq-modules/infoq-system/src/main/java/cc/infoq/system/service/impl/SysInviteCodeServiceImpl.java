package cc.infoq.system.service.impl;

import cc.infoq.common.enums.InviteCodeStatus;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.utils.DateUtils;
import cc.infoq.system.domain.bo.SysInviteCodeBo;
import cc.infoq.system.domain.entity.SysInviteCode;
import cc.infoq.system.domain.vo.SysInviteCodeVo;
import cc.infoq.system.mapper.SysInviteCodeMapper;
import cc.infoq.system.service.SysInviteCodeService;
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.ObjectUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Date;
import java.util.List;

/**
 * Invite code service implementation.
 *
 * @author Pontus
 */
@AllArgsConstructor
@Service
public class SysInviteCodeServiceImpl implements SysInviteCodeService {

    private final SysInviteCodeMapper sysInviteCodeMapper;

    @Override
    public TableDataInfo<SysInviteCodeVo> queryPageList(SysInviteCodeBo bo, PageQuery pageQuery) {
        refreshExpiredInviteCodes();
        Page<SysInviteCodeVo> result = sysInviteCodeMapper.selectPageInviteCodeList(pageQuery.build(), bo);
        return TableDataInfo.build(result);
    }

    @Override
    public List<SysInviteCodeVo> queryList(SysInviteCodeBo bo) {
        refreshExpiredInviteCodes();
        return sysInviteCodeMapper.selectInviteCodeList(bo);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean generateInviteCodes(SysInviteCodeBo bo) {
        Date expireTime = resolveExpireTime(bo.getExpireTime());
        List<SysInviteCode> entities = java.util.stream.IntStream.range(0, bo.getGenerateCount())
            .mapToObj(index -> buildInviteCodeEntity(expireTime, bo.getRemark()))
            .toList();
        return sysInviteCodeMapper.insertBatch(entities);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean cancelInviteCode(SysInviteCodeBo bo) {
        refreshExpiredInviteCodes();
        SysInviteCode entity = sysInviteCodeMapper.selectById(bo.getInviteId());
        if (ObjectUtil.isNull(entity)) {
            throw new ServiceException("邀请码不存在");
        }
        if (!InviteCodeStatus.UNUSED.getCode().equals(entity.getStatus())) {
            throw new ServiceException("该邀请码当前不可作废");
        }
        int rows = sysInviteCodeMapper.update(null,
            new LambdaUpdateWrapper<SysInviteCode>()
                .set(SysInviteCode::getStatus, InviteCodeStatus.CANCELED.getCode())
                .set(SysInviteCode::getCanceledTime, DateUtils.getNowDate())
                .set(SysInviteCode::getCanceledReason, bo.getCanceledReason())
                .eq(SysInviteCode::getInviteId, bo.getInviteId())
                .eq(SysInviteCode::getStatus, InviteCodeStatus.UNUSED.getCode()));
        if (rows < 1) {
            throw new ServiceException("邀请码作废失败");
        }
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean deleteWithValidByIds(Collection<Long> ids) {
        refreshExpiredInviteCodes();
        List<SysInviteCode> list = sysInviteCodeMapper.selectByIds(ids);
        if (list.isEmpty()) {
            return false;
        }
        boolean usedExists = list.stream()
            .anyMatch(item -> InviteCodeStatus.USED.getCode().equals(item.getStatus()));
        if (usedExists) {
            throw new ServiceException("已使用的邀请码不允许删除");
        }
        return sysInviteCodeMapper.deleteByIds(ids) > 0;
    }

    @Override
    public void validateInviteCodeAvailable(String inviteCode) {
        if (inviteCode == null || inviteCode.isBlank()) {
            throw new ServiceException("邀请码不可用");
        }
        refreshExpiredInviteCodes();
        SysInviteCode entity = sysInviteCodeMapper.selectOne(new LambdaQueryWrapper<SysInviteCode>()
            .select(SysInviteCode::getInviteId, SysInviteCode::getStatus, SysInviteCode::getExpireTime)
            .eq(SysInviteCode::getInviteCode, inviteCode));
        if (ObjectUtil.isNull(entity)) {
            throw new ServiceException("邀请码不可用");
        }
        if (!InviteCodeStatus.UNUSED.getCode().equals(entity.getStatus())) {
            throw new ServiceException("邀请码不可用");
        }
        if (ObjectUtil.isNotNull(entity.getExpireTime()) && !entity.getExpireTime().after(DateUtils.getNowDate())) {
            throw new ServiceException("邀请码不可用");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void consumeInviteCode(String inviteCode, Long usedUserId) {
        Date now = DateUtils.getNowDate();
        int rows = sysInviteCodeMapper.consumeInviteCode(inviteCode, usedUserId, now, now);
        if (rows < 1) {
            throw new ServiceException("邀请码不可用");
        }
    }

    private SysInviteCode buildInviteCodeEntity(Date expireTime, String remark) {
        SysInviteCode entity = new SysInviteCode();
        entity.setInviteCode(IdUtil.fastSimpleUUID());
        entity.setStatus(InviteCodeStatus.UNUSED.getCode());
        entity.setExpireTime(expireTime);
        entity.setRemark(remark);
        return entity;
    }

    private Date resolveExpireTime(Date expireTime) {
        Date now = DateUtils.getNowDate();
        if (ObjectUtil.isNull(expireTime)) {
            return DateUtil.offsetYear(now, 100);
        }
        if (!expireTime.after(now)) {
            throw new ServiceException("过期时间必须晚于当前时间");
        }
        return expireTime;
    }

    private void refreshExpiredInviteCodes() {
        sysInviteCodeMapper.expireInviteCodes(DateUtils.getNowDate());
    }
}
