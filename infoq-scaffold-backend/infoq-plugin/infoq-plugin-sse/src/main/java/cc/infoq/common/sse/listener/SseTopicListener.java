package cc.infoq.common.sse.listener;

import cc.infoq.common.sse.core.SseEmitterManager;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;

/**
 * SSE 主题订阅监听器
 *
 * @author Pontus
 */
@Slf4j
public class SseTopicListener implements ApplicationRunner, Ordered {

    @Autowired
    private SseEmitterManager sseEmitterManager;

    /**
     * 在Spring Boot应用程序启动时初始化SSE主题订阅监听器
     *
     * @param args 应用程序参数
     * @throws Exception 初始化过程中可能抛出的异常
     */
    @Override
    public void run(ApplicationArguments args) throws Exception {
        sseEmitterManager.subscribeMessage((message) -> {
            log.info("SSE主题订阅收到消息session keys={} message={}", message.getUserIds(), message.getMessage());
            if (sseEmitterManager.isLocalSource(message.getSourceNodeId())) {
                log.debug("跳过当前节点SSE订阅回环消息sourceNodeId={}", message.getSourceNodeId());
                return;
            }
            sseEmitterManager.sendPublishedMessage(message);
        });
        log.info("初始化SSE主题订阅监听器成功");
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
