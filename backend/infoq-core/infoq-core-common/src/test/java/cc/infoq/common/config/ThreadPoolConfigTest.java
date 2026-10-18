package cc.infoq.common.config;

import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.concurrent.RunnableFuture;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class ThreadPoolConfigTest {

    @Test
    @DisplayName("scheduledExecutorService: should create scheduled thread pool when non-virtual mode")
    void scheduledExecutorServiceShouldCreateExecutor() {
        ThreadPoolConfig config = new ThreadPoolConfig();
        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(SpringUtils::isVirtual).thenReturn(false);

            ScheduledExecutorService service = config.scheduledExecutorService();

            assertInstanceOf(ScheduledThreadPoolExecutor.class, service);
            service.shutdownNow();
        }
    }

    @Test
    @DisplayName("scheduledExecutorService.afterExecute: should trigger printException branch")
    void scheduledExecutorAfterExecuteShouldBeInvocable() throws Exception {
        ThreadPoolConfig config = new ThreadPoolConfig();
        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            springUtils.when(SpringUtils::isVirtual).thenReturn(false);
            ScheduledExecutorService service = config.scheduledExecutorService();
            ScheduledThreadPoolExecutor executor = (ScheduledThreadPoolExecutor) service;

            Method afterExecute = executor.getClass().getDeclaredMethod("afterExecute", Runnable.class, Throwable.class);
            afterExecute.setAccessible(true);
            java.util.concurrent.FutureTask<String> failed = new java.util.concurrent.FutureTask<>(() -> {
                throw new IllegalStateException("boom");
            });
            failed.run();

            assertDoesNotThrow(() -> afterExecute.invoke(executor, failed, null));
            service.shutdownNow();
        }
    }

    @Test
    @DisplayName("destroy: should shutdown gracefully when pool terminates in time")
    void destroyShouldShutdownGracefully() throws Exception {
        ThreadPoolConfig config = new ThreadPoolConfig();
        ScheduledExecutorService pool = mock(ScheduledExecutorService.class);
        when(pool.isShutdown()).thenReturn(false);
        when(pool.awaitTermination(120, TimeUnit.SECONDS)).thenReturn(true);
        setPool(config, pool);

        config.destroy();

        verify(pool).shutdown();
        verify(pool).awaitTermination(120, TimeUnit.SECONDS);
        verify(pool, never()).shutdownNow();
    }

    @Test
    @DisplayName("destroy: should force shutdown when pool cannot terminate in time")
    void destroyShouldForceShutdownWhenTimeout() throws Exception {
        ThreadPoolConfig config = new ThreadPoolConfig();
        ScheduledExecutorService pool = mock(ScheduledExecutorService.class);
        when(pool.isShutdown()).thenReturn(false);
        when(pool.awaitTermination(120, TimeUnit.SECONDS)).thenReturn(false, false);
        setPool(config, pool);

        config.destroy();

        verify(pool).shutdown();
        verify(pool, times(2)).awaitTermination(120, TimeUnit.SECONDS);
        verify(pool).shutdownNow();
    }

    @Test
    @DisplayName("destroy: should force shutdown and keep interrupt flag when interrupted")
    void destroyShouldHandleInterruptedException() throws Exception {
        ThreadPoolConfig config = new ThreadPoolConfig();
        ScheduledExecutorService pool = mock(ScheduledExecutorService.class);
        when(pool.isShutdown()).thenReturn(false);
        when(pool.awaitTermination(120, TimeUnit.SECONDS)).thenThrow(new InterruptedException("interrupted"));
        setPool(config, pool);

        config.destroy();

        verify(pool).shutdown();
        verify(pool).shutdownNow();
        assertTrue(Thread.currentThread().isInterrupted());
        Thread.interrupted();
    }

    @Test
    @DisplayName("printException: should tolerate completed/cancelled/interrupted futures")
    void printExceptionShouldHandleFutureVariants() {
        java.util.concurrent.FutureTask<String> success = new java.util.concurrent.FutureTask<>(() -> "ok");
        success.run();
        java.util.concurrent.FutureTask<String> failed = new java.util.concurrent.FutureTask<>(() -> {
            throw new IllegalStateException("boom");
        });
        failed.run();
        java.util.concurrent.FutureTask<String> cancelled = new java.util.concurrent.FutureTask<>(() -> "ok");
        cancelled.cancel(true);
        RunnableFuture<String> interrupted = new RunnableFuture<>() {
            @Override
            public void run() {
                // no-op
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
            public String get() throws InterruptedException {
                throw new InterruptedException("interrupt");
            }

            @Override
            public String get(long timeout, TimeUnit unit) throws InterruptedException, TimeoutException {
                throw new InterruptedException("interrupt");
            }
        };

        assertDoesNotThrow(() -> ThreadPoolConfig.printException(success, null));
        assertDoesNotThrow(() -> ThreadPoolConfig.printException(failed, null));
        assertDoesNotThrow(() -> ThreadPoolConfig.printException(cancelled, null));
        assertDoesNotThrow(() -> ThreadPoolConfig.printException(interrupted, null));
        Thread.interrupted();
    }

    private static void setPool(ThreadPoolConfig config, ScheduledExecutorService pool) throws Exception {
        Field field = ThreadPoolConfig.class.getDeclaredField("scheduledExecutorService");
        field.setAccessible(true);
        field.set(config, pool);
    }
}
