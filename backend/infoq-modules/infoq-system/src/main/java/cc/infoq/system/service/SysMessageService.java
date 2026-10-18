package cc.infoq.system.service;

import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysMessageQueryBo;
import cc.infoq.system.domain.vo.SysMessageRecipientVo;

public interface SysMessageService {
    void publishSystemNotice(String title, String content, String messageType, String businessKey);
    TableDataInfo<SysMessageRecipientVo> selectCurrentUserPage(Long userId, SysMessageQueryBo query, PageQuery pageQuery);
    long countUnread(Long userId);
    void markRead(Long userId, Long messageId);
    void markAllRead(Long userId);
    void deleteByMessageIds(Long userId, Long[] messageIds);
    MessageCleanupResult cleanupDeletedRecipients(int retentionDays);

    record MessageCleanupResult(int deletedRecipients, int deletedMessages) {
    }
}
