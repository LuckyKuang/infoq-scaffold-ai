package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.utils.DateUtils;
import cc.infoq.system.domain.bo.SysMessageQueryBo;
import cc.infoq.system.domain.entity.SysMessage;
import cc.infoq.system.domain.entity.SysMessageRecipient;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.SysMessageRecipientVo;
import cc.infoq.system.event.SystemMessageCommittedEvent;
import cc.infoq.system.mapper.SysMessageMapper;
import cc.infoq.system.mapper.SysMessageRecipientMapper;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.SysMessageService;
import cn.hutool.core.date.DateUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SysMessageServiceImpl implements SysMessageService {
    private final SysMessageMapper messageMapper;
    private final SysMessageRecipientMapper recipientMapper;
    private final SysUserMapper userMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void publishSystemNotice(String title, String content, String messageType, String businessKey) {
        List<Long> userIds = userMapper.selectList(new LambdaQueryWrapper<SysUser>().select(SysUser::getUserId)
                .eq(SysUser::getStatus, SystemConstants.NORMAL))
            .stream().map(SysUser::getUserId).toList();
        if (userIds.isEmpty()) return;
        SysMessage message = new SysMessage();
        message.setMessageType(messageType);
        message.setMessageLevel("info");
        message.setTitle(title);
        message.setContent(content);
        message.setSource("system_notice");
        message.setBusinessKey(businessKey);
        messageMapper.insert(message);
        List<SysMessageRecipient> recipients = userIds.stream().map(userId -> {
            SysMessageRecipient recipient = new SysMessageRecipient();
            recipient.setMessageId(message.getMessageId());
            recipient.setUserId(userId);
            return recipient;
        }).toList();
        if (!recipientMapper.insertBatch(recipients)) throw new ServiceException("消息接收人创建失败");
        eventPublisher.publishEvent(new SystemMessageCommittedEvent("message-" + message.getMessageId(), message.getMessageId(), userIds));
    }

    @Override
    public TableDataInfo<SysMessageRecipientVo> selectCurrentUserPage(Long userId, SysMessageQueryBo query, PageQuery pageQuery) {
        Page<SysMessageRecipientVo> page = recipientMapper.selectMessagePage(pageQuery.build(), userId, query);
        return TableDataInfo.build(page);
    }

    @Override
    public long countUnread(Long userId) {
        return recipientMapper.selectCount(new LambdaQueryWrapper<SysMessageRecipient>().eq(SysMessageRecipient::getUserId, userId)
            .isNull(SysMessageRecipient::getReadTime).isNull(SysMessageRecipient::getDeleteTime));
    }

    @Override
    public void markRead(Long userId, Long messageId) {
        recipientMapper.update(null, new LambdaUpdateWrapper<SysMessageRecipient>().set(SysMessageRecipient::getReadTime, DateUtils.getNowDate())
            .eq(SysMessageRecipient::getUserId, userId).eq(SysMessageRecipient::getMessageId, messageId)
            .isNull(SysMessageRecipient::getDeleteTime).isNull(SysMessageRecipient::getReadTime));
    }

    @Override
    public void markAllRead(Long userId) {
        recipientMapper.update(null, new LambdaUpdateWrapper<SysMessageRecipient>().set(SysMessageRecipient::getReadTime, DateUtils.getNowDate())
            .eq(SysMessageRecipient::getUserId, userId).isNull(SysMessageRecipient::getDeleteTime).isNull(SysMessageRecipient::getReadTime));
    }

    @Override
    public void deleteByMessageIds(Long userId, Long[] messageIds) {
        if (messageIds == null || messageIds.length == 0) return;
        recipientMapper.update(null, new LambdaUpdateWrapper<SysMessageRecipient>().set(SysMessageRecipient::getDeleteTime, DateUtils.getNowDate())
            .eq(SysMessageRecipient::getUserId, userId).in(SysMessageRecipient::getMessageId, List.of(messageIds))
            .isNull(SysMessageRecipient::getDeleteTime));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MessageCleanupResult cleanupDeletedRecipients(int retentionDays) {
        if (retentionDays < 1) {
            throw new ServiceException("消息软删除保留天数必须至少为 1");
        }
        java.util.Date expiredBefore = DateUtil.offsetDay(DateUtils.getNowDate(), -retentionDays);
        int deletedRecipients = recipientMapper.delete(new LambdaQueryWrapper<SysMessageRecipient>()
            .isNotNull(SysMessageRecipient::getDeleteTime)
            .lt(SysMessageRecipient::getDeleteTime, expiredBefore));
        int deletedMessages = messageMapper.deleteExpiredWithoutRecipients(DateUtils.getNowDate());
        return new MessageCleanupResult(deletedRecipients, deletedMessages);
    }
}
