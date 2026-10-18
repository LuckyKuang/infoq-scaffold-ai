package cc.infoq.common.websocket.listener;

import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.websocket.utils.WebSocketClusterUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.ApplicationArguments;
import org.springframework.context.support.GenericApplicationContext;

import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class WebSocketClusterLifecycleTest {

    @Test
    @DisplayName("run/destroy: should maintain cluster state on start and clean current node on shutdown")
    void lifecycleShouldMaintainClusterStateAndCleanupOnShutdown() {
        ScheduledExecutorService executor = mock(ScheduledExecutorService.class);
        ScheduledFuture<?> future = mock(ScheduledFuture.class);
        when(executor.scheduleWithFixedDelay(any(Runnable.class), anyLong(), anyLong(), any(TimeUnit.class)))
            .thenAnswer(invocation -> future);

        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(ScheduledExecutorService.class, () -> executor);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        try (MockedStatic<WebSocketClusterUtils> clusterUtils = org.mockito.Mockito.mockStatic(WebSocketClusterUtils.class)) {
            clusterUtils.when(WebSocketClusterUtils::currentNodeId).thenReturn("node-1");

            WebSocketClusterLifecycle lifecycle = new WebSocketClusterLifecycle();
            lifecycle.run(mock(ApplicationArguments.class));

            clusterUtils.verify(WebSocketClusterUtils::refreshNodeHeartbeat);
            clusterUtils.verify(WebSocketClusterUtils::syncCurrentNodeUsers);
            clusterUtils.verify(WebSocketClusterUtils::cleanupStaleNodeRegistrations);
            verify(executor).scheduleWithFixedDelay(any(Runnable.class),
                org.mockito.Mockito.eq(WebSocketClusterUtils.NODE_HEARTBEAT_INTERVAL_SECONDS),
                org.mockito.Mockito.eq(WebSocketClusterUtils.NODE_HEARTBEAT_INTERVAL_SECONDS),
                org.mockito.Mockito.eq(TimeUnit.SECONDS));
            assertEquals(-2, lifecycle.getOrder());

            lifecycle.destroy();

            verify(future).cancel(false);
            clusterUtils.verify(WebSocketClusterUtils::unregisterCurrentNode);
        }
    }
}
