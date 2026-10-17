package cc.infoq.system.service.impl;

import cc.infoq.common.log.event.OperLogEvent;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.ip.AddressUtils;
import cc.infoq.system.domain.bo.SysOperLogBo;
import cc.infoq.system.domain.entity.SysOperLog;
import cc.infoq.system.domain.vo.SysOperLogVo;
import cc.infoq.system.mapper.SysOperLogMapper;
import cc.infoq.system.service.SysOperLogService;
import cn.hutool.core.util.ArrayUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.AllArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 操作日志 服务层处理
 *
 * @author Pontus
 */
@AllArgsConstructor
@Service
public class SysOperLogServiceImpl implements SysOperLogService {

    private final SysOperLogMapper sysOperLogMapper;

    /**
     * 操作日志记录
     *
     * @param operLogEvent 操作日志事件
     */
    @Async
    @EventListener
    public void recordOper(OperLogEvent operLogEvent) {
        SysOperLogBo operLog = MapstructUtils.convert(operLogEvent, SysOperLogBo.class);
        // 远程查询操作地点
        operLog.setOperLocation(AddressUtils.getRealAddressByIP(operLog.getOperIp()));
        insertOperLog(operLog);
    }

    /**
     * 分页查询操作日志列表
     *
     * @param operLog   查询条件
     * @param pageQuery 分页参数
     * @return 操作日志分页列表
     */
    @Override
    public TableDataInfo<SysOperLogVo> selectPageOperLogList(SysOperLogBo operLog, PageQuery pageQuery) {
        LambdaQueryWrapper<SysOperLog> lqw = buildQueryWrapper(operLog);
        if (StringUtils.isBlank(pageQuery.getOrderByColumn())) {
            lqw.orderByDesc(SysOperLog::getOperId);
        }
        Page<SysOperLogVo> page = sysOperLogMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(page);
    }

    private LambdaQueryWrapper<SysOperLog> buildQueryWrapper(SysOperLogBo operLog) {
        Map<String, Object> params = operLog.getParams();
        return new LambdaQueryWrapper<SysOperLog>()
            .like(StringUtils.isNotBlank(operLog.getOperIp()), SysOperLog::getOperIp, operLog.getOperIp())
            .like(StringUtils.isNotBlank(operLog.getTitle()), SysOperLog::getTitle, operLog.getTitle())
            .eq(operLog.getBusinessType() != null && operLog.getBusinessType() > 0,
                SysOperLog::getBusinessType, operLog.getBusinessType())
            .func(f -> {
                if (ArrayUtil.isNotEmpty(operLog.getBusinessTypes())) {
                    f.in(SysOperLog::getBusinessType, Arrays.asList(operLog.getBusinessTypes()));
                }
            })
            .eq(operLog.getStatus() != null,
                SysOperLog::getStatus, operLog.getStatus())
            .like(StringUtils.isNotBlank(operLog.getOperName()), SysOperLog::getOperName, operLog.getOperName())
            .between(params.get("beginTime") != null && params.get("endTime") != null,
                SysOperLog::getOperTime, params.get("beginTime"), params.get("endTime"));
    }

    /**
     * 新增操作日志
     *
     * @param bo 操作日志对象
     */
    @Override
    public void insertOperLog(SysOperLogBo bo) {
        SysOperLog operLog = MapstructUtils.convert(bo, SysOperLog.class);
        operLog.setOperTime(new Date());
        sysOperLogMapper.insert(operLog);
    }

    /**
     * 查询系统操作日志集合
     *
     * @param operLog 操作日志对象
     * @return 操作日志集合
     */
    @Override
    public List<SysOperLogVo> selectOperLogList(SysOperLogBo operLog) {
        LambdaQueryWrapper<SysOperLog> lqw = buildQueryWrapper(operLog);
        return sysOperLogMapper.selectVoList(lqw.orderByDesc(SysOperLog::getOperId));
    }

    /**
     * 批量删除系统操作日志
     *
     * @param operIds 需要删除的操作日志ID
     * @return 结果
     */
    @Override
    public int deleteOperLogByIds(Long[] operIds) {
        return sysOperLogMapper.deleteByIds(Arrays.asList(operIds));
    }

    /**
     * 查询操作日志详细
     *
     * @param operId 操作ID
     * @return 操作日志对象
     */
    @Override
    public SysOperLogVo selectOperLogById(Long operId) {
        return sysOperLogMapper.selectVoById(operId);
    }

    /**
     * 清空操作日志
     */
    @Override
    public void cleanOperLog() {
        sysOperLogMapper.delete(new LambdaQueryWrapper<>());
    }
}
