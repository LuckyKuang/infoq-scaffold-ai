package cc.infoq.common.websocket.utils;

import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.websocket.dto.WebSocketMessageDto;
import cc.infoq.common.websocket.holder.WebSocketSessionHolder;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import static cc.infoq.common.websocket.constant.WebSocketConstants.WEB_SOCKET_TOPIC;

/**
 * 工具类
 *
 * @author Pontus
 */
@Slf4j
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class WebSocketUtils {

    /**
     * 向指定的WebSocket会话发送消息
     *
     * @param sessionKey 要发送消息的用户id
     * @param message    要发送的消息内容
     */
    public static void sendMessage(Long sessionKey, String message) {
        Collection<WebSocketSession> sessions = WebSocketSessionHolder.getSessions(sessionKey);
        sessions.forEach(session -> sendMessage(session, message));
    }

    /**
     * 订阅WebSocket消息主题，并提供一个消费者函数来处理接收到的消息
     *
     * @param consumer 处理WebSocket消息的消费者函数
     */
    public static void subscribeMessage(Consumer<WebSocketMessageDto> consumer) {
        RedisUtils.subscribe(WEB_SOCKET_TOPIC, WebSocketMessageDto.class, consumer);
    }

    /**
     * 订阅当前节点的 WebSocket 定向消息。
     *
     * @param consumer 消费函数
     */
    public static void subscribeNodeMessage(Consumer<WebSocketMessageDto> consumer) {
        RedisUtils.subscribe(WebSocketClusterUtils.currentNodeTopic(), WebSocketMessageDto.class, consumer);
    }

    /**
     * 发布WebSocket订阅消息
     *
     * @param webSocketMessage 要发布的WebSocket消息对象
     */
    public static void publishMessage(WebSocketMessageDto webSocketMessage) {
        Map<String, List<Long>> routedSessionKeys = WebSocketClusterUtils.routeSessionKeysByNode(webSocketMessage.getSessionKeys());
        if (routedSessionKeys.isEmpty()) {
            log.info("WebSocket定向消息未命中在线节点, session keys={}", webSocketMessage.getSessionKeys());
            return;
        }
        routedSessionKeys.forEach((nodeId, sessionKeys) -> {
            WebSocketMessageDto routedMessage = new WebSocketMessageDto();
            routedMessage.setMessage(webSocketMessage.getMessage());
            routedMessage.setSessionKeys(sessionKeys);
            RedisUtils.publish(WebSocketClusterUtils.nodeTopic(nodeId), routedMessage, consumer -> {
                log.info("WebSocket发送节点主题订阅消息topic:{} session keys:{} message:{}",
                    WebSocketClusterUtils.nodeTopic(nodeId), sessionKeys, webSocketMessage.getMessage());
            });
        });
    }

    /**
     * 向所有的WebSocket会话发布订阅的消息(群发)
     *
     * @param message 要发布的消息内容
     */
    public static void publishAll(String message) {
        WebSocketMessageDto broadcastMessage = new WebSocketMessageDto();
        broadcastMessage.setMessage(message);
        RedisUtils.publish(WEB_SOCKET_TOPIC, broadcastMessage, consumer -> {
            log.info("WebSocket发送主题订阅消息topic:{} message:{}", WEB_SOCKET_TOPIC, message);
        });
    }

    /**
     * 向指定的WebSocket会话发送Pong消息
     *
     * @param session 要发送Pong消息的WebSocket会话
     */
    public static void sendPongMessage(WebSocketSession session) {
        sendMessage(session, new PongMessage());
    }

    /**
     * 向指定的WebSocket会话发送文本消息
     *
     * @param session WebSocket会话
     * @param message 要发送的文本消息内容
     */
    public static void sendMessage(WebSocketSession session, String message) {
        sendMessage(session, new TextMessage(message));
    }

    /**
     * 向指定的WebSocket会话发送WebSocket消息对象
     *
     * @param session WebSocket会话
     * @param message 要发送的WebSocket消息对象
     */
    private static void sendMessage(WebSocketSession session, WebSocketMessage<?> message) {
        if (session == null || !session.isOpen()) {
            log.warn("[send] session会话已经关闭");
        } else {
            try {
                session.sendMessage(message);
            } catch (IOException e) {
                log.error("[send] session({}) 发送消息({}) 异常", session, message, e);
            }
        }
    }
}
