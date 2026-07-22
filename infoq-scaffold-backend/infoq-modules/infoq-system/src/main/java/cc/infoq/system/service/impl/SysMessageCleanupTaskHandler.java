package cc.infoq.system.service.impl;

import cc.infoq.common.quartz.core.ManagedQuartzTaskHandler;
import cc.infoq.system.config.MessageCleanupProperties;
import cc.infoq.system.service.SysMessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 由 sys_job 显式启用的消息清理任务处理器。
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "infoq.quartz", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SysMessageCleanupTaskHandler implements ManagedQuartzTaskHandler {

    public static final String HANDLER_KEY = "system.message.cleanup";

    private final MessageCleanupProperties properties;
    private final SysMessageService messageService;

    @Override
    public String handlerKey() {
        return HANDLER_KEY;
    }

    @Override
    public void execute(Map<String, Object> params) {
        if (!properties.isEnabled()) {
            log.info("消息清理任务已跳过，infoq.message.cleanup.enabled=false");
            return;
        }
        SysMessageService.MessageCleanupResult result = messageService.cleanupDeletedRecipients(properties.getSoftDeleteRetentionDays());
        log.info("消息清理任务完成，deletedRecipients:{}, deletedMessages:{}",
            result.deletedRecipients(), result.deletedMessages());
    }
}
