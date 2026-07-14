package cc.infoq.system.listener;

import cc.infoq.common.push.domain.PushRecipient;
import cc.infoq.common.push.domain.PushRequest;
import cc.infoq.common.push.service.PushService;
import cc.infoq.system.event.SystemMessageCommittedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class SysMessagePushListener {
    private final ObjectProvider<PushService> pushServiceProvider;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onMessageCommitted(SystemMessageCommittedEvent event) {
        PushService pushService = pushServiceProvider.getIfAvailable();
        if (pushService == null) return;
        try {
            pushService.push(new PushRequest(event.correlationId(), event.messageId(),
                event.recipientUserIds().stream().map(PushRecipient::new).toList(),
                "{\"type\":\"message\",\"messageId\":" + event.messageId() + "}"));
        } catch (RuntimeException e) {
            log.warn("Message Push failed after commit, correlationId:{}, messageId:{}, recipients:{}, type:{}",
                event.correlationId(), event.messageId(), event.recipientUserIds().size(), e.getClass().getSimpleName());
        }
    }
}
