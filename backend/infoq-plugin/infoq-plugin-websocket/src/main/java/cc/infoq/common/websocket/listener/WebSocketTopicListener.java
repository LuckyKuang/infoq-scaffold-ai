package cc.infoq.common.websocket.listener;

import cc.infoq.common.websocket.holder.WebSocketSessionHolder;
import cc.infoq.common.websocket.utils.WebSocketUtils;
import cn.hutool.core.collection.CollUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;

/**
 * WebSocket 主题订阅监听器
 *
 * @author Pontus
 */
@Slf4j
public class WebSocketTopicListener implements ApplicationRunner, Ordered {

    /**
     * 在Spring Boot应用程序启动时初始化WebSocket主题订阅监听器
     *
     * @param args 应用程序参数
     * @throws Exception 初始化过程中可能抛出的异常
     */
    @Override
    public void run(ApplicationArguments args) throws Exception {
        WebSocketUtils.subscribeMessage(this::dispatchMessage);
        WebSocketUtils.subscribeNodeMessage(this::dispatchMessage);
        log.info("初始化WebSocket主题订阅监听器成功");
    }

    @Override
    public int getOrder() {
        return -1;
    }

    void dispatchMessage(cc.infoq.common.websocket.dto.WebSocketMessageDto message) {
        log.debug("WebSocket topic received, correlationId:{}, messageId:{}, recipients:{}",
            message.getCorrelationId(), message.getMessageId(), message.getSessionKeys() == null ? 0 : message.getSessionKeys().size());
        if (CollUtil.isNotEmpty(message.getSessionKeys())) {
            message.getSessionKeys().forEach(key -> {
                if (WebSocketSessionHolder.existSession(key)) {
                    WebSocketUtils.sendPublishedMessage(key, message);
                }
            });
            return;
        }
        WebSocketSessionHolder.getSessionsAll().forEach(key -> WebSocketUtils.sendPublishedMessage(key, message));
    }
}
