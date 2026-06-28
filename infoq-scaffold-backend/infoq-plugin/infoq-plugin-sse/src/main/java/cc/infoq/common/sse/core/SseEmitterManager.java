package cc.infoq.common.sse.core;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.sse.dto.SseMessageDto;
import cc.infoq.common.utils.SpringUtils;
import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.map.MapUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * 管理 Server-Sent Events (SSE) 连接
 *
 * @author Pontus
 */
@Slf4j
public class SseEmitterManager {

    /**
     * 订阅的频道
     */
    private final static String SSE_TOPIC = "global:sse";

    private final static String NODE_ID = UUID.randomUUID().toString();

    private final static Map<Long, Map<String, SseEmitter>> USER_TOKEN_EMITTERS = new ConcurrentHashMap<>();

    static Map<Long, Map<String, SseEmitter>> emitterStore() {
        return USER_TOKEN_EMITTERS;
    }

    public SseEmitterManager() {
        // 定时执行 SSE 心跳检测
        SpringUtils.getBean(ScheduledExecutorService.class)
            .scheduleWithFixedDelay(this::sseMonitor, 60L, 60L, TimeUnit.SECONDS);
    }

    /**
     * 建立与指定用户的 SSE 连接
     *
     * @param userId 用户的唯一标识符，用于区分不同用户的连接
     * @param token  用户的唯一令牌，用于识别具体的连接
     * @return 返回一个 SseEmitter 实例，客户端可以通过该实例接收 SSE 事件
     */
    public SseEmitter connect(Long userId, String token) {
        // 从 USER_TOKEN_EMITTERS 中获取或创建当前用户的 SseEmitter 映射表（ConcurrentHashMap）
        // 每个用户可以有多个 SSE 连接，通过 token 进行区分
        Map<String, SseEmitter> emitters = USER_TOKEN_EMITTERS.computeIfAbsent(userId, k -> new ConcurrentHashMap<>());

        // 关闭已存在的SseEmitter，防止超过最大连接数
        SseEmitter oldEmitter = emitters.remove(token);
        if (oldEmitter != null) {
            oldEmitter.complete();
        }

        // 创建一个新的 SseEmitter 实例，超时时间设置为一天 避免连接之后直接关闭浏览器导致连接停滞
        SseEmitter emitter = new SseEmitter(86400000L);

        emitters.put(token, emitter);

        // 当 emitter 完成、超时或发生错误时，只清理当前回调对应的连接，避免旧连接回调误删同 token 新连接。
        emitter.onCompletion(() -> removeEmitter(userId, token, emitter, false));
        emitter.onTimeout(() -> removeEmitter(userId, token, emitter, true));
        emitter.onError((e) -> removeEmitter(userId, token, emitter, true));

        try {
            // 向客户端发送一条连接成功的事件
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (IOException e) {
            // 如果发送消息失败，则从映射表中移除 emitter
            emitters.remove(token);
            if (emitters.isEmpty()) {
                USER_TOKEN_EMITTERS.remove(userId);
            }
            try {
                emitter.completeWithError(e);
            } catch (Exception ex) {
                log.warn("SSE连接初始化清理失败, userId={}", userId, ex);
            }
            log.warn("SSE连接初始化事件发送失败, userId={}", userId, e);
            throw new ServiceException("建立SSE连接失败");
        }
        return emitter;
    }

    /**
     * 断开指定用户的 SSE 连接
     *
     * @param userId 用户的唯一标识符，用于区分不同用户的连接
     * @param token  用户的唯一令牌，用于识别具体的连接
     */
    public void disconnect(Long userId, String token) {
        if (userId == null || token == null) {
            return;
        }
        Map<String, SseEmitter> emitters = USER_TOKEN_EMITTERS.get(userId);
        if (MapUtil.isNotEmpty(emitters)) {
            SseEmitter sseEmitter = emitters.remove(token);
            if (sseEmitter == null) {
                if (emitters.isEmpty()) {
                    USER_TOKEN_EMITTERS.remove(userId);
                }
                return;
            }
            try {
                sseEmitter.send(SseEmitter.event().comment("disconnected"));
            } catch (Exception e) {
                log.warn("SSE断开通知发送失败, userId={}", userId, e);
            }
            try {
                sseEmitter.complete();
            } catch (Exception e) {
                log.warn("SSE连接关闭失败, userId={}", userId, e);
            }
            if (emitters.isEmpty()) {
                USER_TOKEN_EMITTERS.remove(userId);
            }
        } else {
            USER_TOKEN_EMITTERS.remove(userId);
        }
    }

    /**
     * SSE 心跳检测，关闭无效连接
     */
    public void sseMonitor() {
        final SseEmitter.SseEventBuilder heartbeat = SseEmitter.event().comment("heartbeat");
        // 记录需要移除的用户ID
        List<Long> toRemoveUsers = new ArrayList<>();

        USER_TOKEN_EMITTERS.forEach((userId, emitterMap) -> {
            if (CollUtil.isEmpty(emitterMap)) {
                toRemoveUsers.add(userId);
                return;
            }

            emitterMap.entrySet().removeIf(entry -> {
                try {
                    entry.getValue().send(heartbeat);
                    return false;
                } catch (Exception ex) {
                    log.warn("SSE心跳发送失败, userId={}", userId, ex);
                    try {
                        entry.getValue().complete();
                    } catch (Exception ignore) {
                        log.warn("SSE失效连接关闭失败, userId={}", userId, ignore);
                    }
                    return true; // 发送失败 → 移除该连接
                }
            });

            // 移除空连接用户
            if (emitterMap.isEmpty()) {
                toRemoveUsers.add(userId);
            }
        });

        // 循环结束后统一清理空用户，避免并发修改异常
        toRemoveUsers.forEach(USER_TOKEN_EMITTERS::remove);
    }

    /**
     * 订阅SSE消息主题，并提供一个消费者函数来处理接收到的消息
     *
     * @param consumer 处理SSE消息的消费者函数
     */
    public void subscribeMessage(Consumer<SseMessageDto> consumer) {
        RedisUtils.subscribe(SSE_TOPIC, SseMessageDto.class, consumer);
    }

    /**
     * 向指定的用户会话发送消息
     *
     * @param userId  要发送消息的用户id
     * @param message 要发送的消息内容
     */
    public void sendMessage(Long userId, String message) {
        Map<String, SseEmitter> emitters = USER_TOKEN_EMITTERS.get(userId);
        if (MapUtil.isNotEmpty(emitters)) {
            for (Map.Entry<String, SseEmitter> entry : emitters.entrySet()) {
                try {
                    entry.getValue().send(SseEmitter.event()
                        .name("message")
                        .data(message));
                } catch (Exception e) {
                    log.warn("SSE消息发送失败, userId={}", userId, e);
                    removeEmitter(userId, entry.getKey(), entry.getValue(), true);
                }
            }
        } else {
            USER_TOKEN_EMITTERS.remove(userId);
        }
    }

    /**
     * 本机全用户会话发送消息
     *
     * @param message 要发送的消息内容
     */
    public void sendMessage(String message) {
        for (Long userId : USER_TOKEN_EMITTERS.keySet()) {
            sendMessage(userId, message);
        }
    }

    /**
     * 将已发布消息投递到当前节点持有的 SSE 连接。
     */
    public void sendPublishedMessage(SseMessageDto message) {
        if (message == null) {
            return;
        }
        if (CollUtil.isNotEmpty(message.getUserIds())) {
            message.getUserIds().stream()
                .filter(userId -> userId != null)
                .forEach(userId -> sendMessage(userId, message.getMessage()));
            return;
        }
        sendMessage(message.getMessage());
    }

    /**
     * 判断消息是否由当前节点发布。
     */
    public boolean isLocalSource(String sourceNodeId) {
        return NODE_ID.equals(sourceNodeId);
    }

    String currentNodeId() {
        return NODE_ID;
    }

    private void removeEmitter(Long userId, String token, SseEmitter emitter, boolean complete) {
        Map<String, SseEmitter> emitters = USER_TOKEN_EMITTERS.get(userId);
        if (MapUtil.isEmpty(emitters)) {
            USER_TOKEN_EMITTERS.remove(userId);
            return;
        }
        boolean removed = emitters.remove(token, emitter);
        if (removed && complete) {
            try {
                emitter.complete();
            } catch (Exception e) {
                log.warn("SSE连接关闭失败, userId={}", userId, e);
            }
        }
        if (emitters.isEmpty()) {
            USER_TOKEN_EMITTERS.remove(userId, emitters);
        }
    }

    /**
     * 发布SSE订阅消息
     *
     * @param sseMessageDto 要发布的SSE消息对象
     */
    public void publishMessage(SseMessageDto sseMessageDto) {
        SseMessageDto broadcastMessage = new SseMessageDto();
        broadcastMessage.setMessage(sseMessageDto.getMessage());
        broadcastMessage.setUserIds(sseMessageDto.getUserIds());
        broadcastMessage.setSourceNodeId(NODE_ID);
        RedisUtils.publish(SSE_TOPIC, broadcastMessage, consumer -> {
            log.info("SSE发送主题订阅消息topic:{} session keys:{} message:{}",
                SSE_TOPIC, sseMessageDto.getUserIds(), sseMessageDto.getMessage());
        });
        sendPublishedMessage(broadcastMessage);
    }

    /**
     * 向所有的用户发布订阅的消息(群发)
     *
     * @param message 要发布的消息内容
     */
    public void publishAll(String message) {
        SseMessageDto broadcastMessage = new SseMessageDto();
        broadcastMessage.setMessage(message);
        broadcastMessage.setSourceNodeId(NODE_ID);
        RedisUtils.publish(SSE_TOPIC, broadcastMessage, consumer -> {
            log.info("SSE发送主题订阅消息topic:{} message:{}", SSE_TOPIC, message);
        });
        sendPublishedMessage(broadcastMessage);
    }
}
