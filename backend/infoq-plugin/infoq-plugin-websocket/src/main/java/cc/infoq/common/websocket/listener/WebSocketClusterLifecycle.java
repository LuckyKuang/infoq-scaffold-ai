package cc.infoq.common.websocket.listener;

import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.websocket.utils.WebSocketClusterUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;

import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * WebSocket 集群节点生命周期管理。
 */
@Slf4j
public class WebSocketClusterLifecycle implements ApplicationRunner, Ordered, DisposableBean {

    private ScheduledFuture<?> heartbeatFuture;

    @Override
    public void run(ApplicationArguments args) {
        maintainClusterState();
        ScheduledExecutorService scheduledExecutorService = SpringUtils.getBean(ScheduledExecutorService.class);
        heartbeatFuture = scheduledExecutorService.scheduleWithFixedDelay(this::maintainClusterStateSafely,
            WebSocketClusterUtils.NODE_HEARTBEAT_INTERVAL_SECONDS,
            WebSocketClusterUtils.NODE_HEARTBEAT_INTERVAL_SECONDS,
            TimeUnit.SECONDS);
        log.info("初始化WebSocket集群节点成功, nodeId={}", WebSocketClusterUtils.currentNodeId());
    }

    @Override
    public int getOrder() {
        return -2;
    }

    @Override
    public void destroy() {
        if (heartbeatFuture != null) {
            heartbeatFuture.cancel(false);
        }
        WebSocketClusterUtils.unregisterCurrentNode();
        log.info("清理WebSocket集群节点成功, nodeId={}", WebSocketClusterUtils.currentNodeId());
    }

    /**
     * 周期任务抛出异常会被 ScheduledExecutorService 永久取消，导致本节点心跳过期后被其他节点判定下线；
     * 单轮失败只记录并等待下一轮重试。启动时首轮仍直接调用 maintainClusterState，失败即显式暴露。
     */
    void maintainClusterStateSafely() {
        try {
            maintainClusterState();
        } catch (RuntimeException e) {
            log.warn("WebSocket集群节点心跳维护失败, 等待下一轮重试, nodeId={}", WebSocketClusterUtils.currentNodeId(), e);
        }
    }

    private void maintainClusterState() {
        WebSocketClusterUtils.refreshNodeHeartbeat();
        WebSocketClusterUtils.syncCurrentNodeUsers();
        WebSocketClusterUtils.cleanupStaleNodeRegistrations();
    }
}
