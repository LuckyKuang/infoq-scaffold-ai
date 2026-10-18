package cc.infoq.common.websocket.holder;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocketSession 用于保存当前所有在线的会话信息
 *
 * @author Pontus
 */
@Slf4j
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class WebSocketSessionHolder {

    private static final Map<Long, Map<String, WebSocketSession>> USER_SESSION_MAP = new ConcurrentHashMap<>();

    /**
     * 将WebSocket会话添加到用户会话Map中
     *
     * @param sessionKey 会话键，用于检索会话
     * @param session    要添加的WebSocket会话
     */
    public static void addSession(Long sessionKey, WebSocketSession session) {
        if (session == null) {
            return;
        }
        addSession(sessionKey, session.getId(), session);
    }

    /**
     * 将 WebSocket 会话添加到指定用户下，支持同一用户保留多个会话。
     *
     * @param sessionKey 用户标识
     * @param sessionId  当前会话 ID
     * @param session    会话对象
     */
    public static void addSession(Long sessionKey, String sessionId, WebSocketSession session) {
        if (sessionKey == null || sessionId == null || session == null) {
            return;
        }
        Map<String, WebSocketSession> sessions = USER_SESSION_MAP.computeIfAbsent(sessionKey, key -> new ConcurrentHashMap<>());
        WebSocketSession previous = sessions.put(sessionId, session);
        if (previous != null && previous != session) {
            closeSession(previous, sessionKey, sessionId);
        }
    }

    /**
     * 从用户会话Map中移除指定会话键对应的WebSocket会话
     *
     * @param sessionKey 要移除的会话键
     */
    public static void removeSession(Long sessionKey) {
        Map<String, WebSocketSession> sessions = USER_SESSION_MAP.remove(sessionKey);
        if (sessions == null) {
            return;
        }
        sessions.forEach((sessionId, session) -> closeSession(session, sessionKey, sessionId));
    }

    /**
     * 从用户会话表中移除单个会话，不主动关闭连接，适用于连接关闭回调阶段。
     *
     * @param sessionKey 用户标识
     * @param sessionId  会话 ID
     */
    public static void removeSession(Long sessionKey, String sessionId) {
        if (sessionKey == null || sessionId == null) {
            return;
        }
        Map<String, WebSocketSession> sessions = USER_SESSION_MAP.get(sessionKey);
        if (sessions == null) {
            return;
        }
        sessions.remove(sessionId);
        if (sessions.isEmpty()) {
            USER_SESSION_MAP.remove(sessionKey, sessions);
        }
    }

    /**
     * 根据会话键从用户会话Map中获取WebSocket会话
     *
     * @param sessionKey 要获取的会话键
     * @return 与给定会话键对应的WebSocket会话，如果不存在则返回null
     */
    public static Collection<WebSocketSession> getSessions(Long sessionKey) {
        Map<String, WebSocketSession> sessions = USER_SESSION_MAP.get(sessionKey);
        if (sessions == null || sessions.isEmpty()) {
            return java.util.List.of();
        }
        return new ArrayList<>(sessions.values());
    }

    /**
     * 获取存储在用户会话Map中所有WebSocket会话的会话键集合
     *
     * @return 所有WebSocket会话的会话键集合
     */
    public static Set<Long> getSessionsAll() {
        return USER_SESSION_MAP.keySet();
    }

    /**
     * 检查给定的会话键是否存在于用户会话Map中
     *
     * @param sessionKey 要检查的会话键
     * @return 如果存在对应的会话键，则返回true；否则返回false
     */
    public static Boolean existSession(Long sessionKey) {
        Map<String, WebSocketSession> sessions = USER_SESSION_MAP.get(sessionKey);
        return sessions != null && !sessions.isEmpty();
    }

    /**
     * 获取指定用户当前本地连接数
     *
     * @param sessionKey 用户标识
     * @return 当前连接数量
     */
    public static int sessionCount(Long sessionKey) {
        Map<String, WebSocketSession> sessions = USER_SESSION_MAP.get(sessionKey);
        return sessions == null ? 0 : sessions.size();
    }

    private static void closeSession(WebSocketSession session, Long sessionKey, String sessionId) {
        try {
            session.close(CloseStatus.NORMAL);
        } catch (Exception e) {
            log.warn("WebSocket会话关闭失败, sessionKey={}, sessionId={}", sessionKey, sessionId, e);
        }
    }
}
