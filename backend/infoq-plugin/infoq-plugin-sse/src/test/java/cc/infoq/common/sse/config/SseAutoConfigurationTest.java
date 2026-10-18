package cc.infoq.common.sse.config;

import cc.infoq.common.security.auth.CurrentUserService;
import cc.infoq.common.security.auth.SecurityTokenResolver;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.sse.controller.SseController;
import cc.infoq.common.sse.core.SseEmitterManager;
import cc.infoq.common.sse.listener.SseTopicListener;
import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.support.GenericApplicationContext;

import java.util.concurrent.Delayed;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;

@Tag("dev")
class SseAutoConfigurationTest {

    private static final GenericApplicationContext CONTEXT = new GenericApplicationContext();

    static {
        ScheduledExecutorService executor = mock(ScheduledExecutorService.class);
        Mockito.doReturn(new NoOpScheduledFuture())
            .when(executor)
            .scheduleWithFixedDelay(any(Runnable.class), eq(60L), eq(60L), eq(TimeUnit.SECONDS));
        CONTEXT.registerBean(ScheduledExecutorService.class, () -> executor);
        CONTEXT.refresh();
        new SpringUtils().setApplicationContext(CONTEXT);
    }

    @AfterAll
    static void closeContext() {
        CONTEXT.close();
    }

    @Test
    @DisplayName("beans: should create manager/listener/controller")
    void beanMethodsShouldCreateInstances() {
        SseAutoConfiguration configuration = new SseAutoConfiguration();
        SseEmitterManager manager = configuration.sseEmitterManager();
        SseTopicListener listener = configuration.sseTopicListener();
        SseController controller = configuration.sseController(
            manager,
            mock(SecurityTokenResolver.class),
            mock(SecurityTokenService.class),
            mock(CurrentUserService.class));

        assertNotNull(manager);
        assertNotNull(listener);
        assertNotNull(controller);
    }

    private static final class NoOpScheduledFuture implements ScheduledFuture<Object> {
        @Override
        public long getDelay(TimeUnit unit) {
            return 0L;
        }

        @Override
        public int compareTo(Delayed o) {
            return 0;
        }

        @Override
        public boolean cancel(boolean mayInterruptIfRunning) {
            return false;
        }

        @Override
        public boolean isCancelled() {
            return false;
        }

        @Override
        public boolean isDone() {
            return true;
        }

        @Override
        public Object get() {
            return null;
        }

        @Override
        public Object get(long timeout, TimeUnit unit) {
            return null;
        }
    }
}
