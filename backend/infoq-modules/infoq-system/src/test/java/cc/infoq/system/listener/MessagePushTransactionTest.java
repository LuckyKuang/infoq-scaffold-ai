package cc.infoq.system.listener;

import cc.infoq.common.push.service.PushService;
import cc.infoq.system.event.SystemMessageCommittedEvent;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class MessagePushTransactionTest {
    @Test void rollbackDoesNotPushAndCommitFailureCannotReverseCommittedState() {
        PushService push = mock(PushService.class);
        ObjectProvider<PushService> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(push);
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.register(TransactionConfiguration.class);
            context.registerBean(SysMessagePushListener.class, () -> new SysMessagePushListener(provider));
            context.refresh();
            TestTransactionManager manager = new TestTransactionManager();
            TransactionTemplate transaction = new TransactionTemplate(manager);
            transaction.executeWithoutResult(status -> {
                context.publishEvent(new SystemMessageCommittedEvent("rollback", 7L, List.of(10L)));
                verifyNoInteractions(push);
                status.setRollbackOnly();
            });
            verifyNoInteractions(push);
            assertEquals(0, manager.commits);
            doThrow(new IllegalStateException("private-payload")).when(push).push(any());
            assertDoesNotThrow(() -> transaction.executeWithoutResult(status -> {
                context.publishEvent(new SystemMessageCommittedEvent("commit", 8L, List.of(10L)));
                verifyNoInteractions(push);
            }));
            assertEquals(1, manager.commits);
            verify(push).push(any());
        }
    }
    @Configuration(proxyBeanMethods = false)
    @EnableTransactionManagement
    static class TransactionConfiguration {}
    static class TestTransactionManager extends AbstractPlatformTransactionManager {
        int commits;
        @Override protected Object doGetTransaction() { return new Object(); }
        @Override protected void doBegin(Object tx, TransactionDefinition definition) {}
        @Override protected void doCommit(DefaultTransactionStatus status) { commits++; }
        @Override protected void doRollback(DefaultTransactionStatus status) {}
    }
}
