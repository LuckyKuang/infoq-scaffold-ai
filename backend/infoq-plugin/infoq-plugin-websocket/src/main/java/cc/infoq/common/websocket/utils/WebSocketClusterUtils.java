package cc.infoq.common.websocket.utils;

import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.websocket.holder.WebSocketSessionHolder;
import cn.hutool.core.convert.Convert;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RSet;
import org.springframework.core.env.Environment;

import java.lang.management.ManagementFactory;
import java.net.InetAddress;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static cc.infoq.common.websocket.constant.WebSocketConstants.WEB_SOCKET_NODE_HEARTBEAT_KEY_PREFIX;
import static cc.infoq.common.websocket.constant.WebSocketConstants.WEB_SOCKET_NODE_TOPIC_PREFIX;
import static cc.infoq.common.websocket.constant.WebSocketConstants.WEB_SOCKET_NODE_USER_SET_PREFIX;
import static cc.infoq.common.websocket.constant.WebSocketConstants.WEB_SOCKET_USER_NODE_SET_PREFIX;

/**
 * WebSocket 集群路由辅助工具。
 */
@Slf4j
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class WebSocketClusterUtils {

    public static final long NODE_HEARTBEAT_INTERVAL_SECONDS = 30L;
    public static final Duration NODE_HEARTBEAT_TTL = Duration.ofSeconds(90L);

    private static volatile String currentNodeId;

    public static String currentNodeId() {
        if (currentNodeId == null) {
            synchronized (WebSocketClusterUtils.class) {
                if (currentNodeId == null) {
                    currentNodeId = resolveNodeId();
                }
            }
        }
        return currentNodeId;
    }

    public static String currentNodeTopic() {
        return nodeTopic(currentNodeId());
    }

    public static String nodeTopic(String nodeId) {
        return WEB_SOCKET_NODE_TOPIC_PREFIX + nodeId;
    }

    static String userNodeSetKey(Long userId) {
        return WEB_SOCKET_USER_NODE_SET_PREFIX + userId;
    }

    static String nodeHeartbeatKey(String nodeId) {
        return WEB_SOCKET_NODE_HEARTBEAT_KEY_PREFIX + nodeId;
    }

    static String nodeUserSetKey(String nodeId) {
        return WEB_SOCKET_NODE_USER_SET_PREFIX + nodeId;
    }

    public static void refreshNodeHeartbeat() {
        String nodeId = currentNodeId();
        RedisUtils.setCacheObject(nodeHeartbeatKey(nodeId), nodeId, NODE_HEARTBEAT_TTL);
    }

    public static void registerUser(Long userId) {
        if (userId == null) {
            return;
        }
        String nodeId = currentNodeId();
        RSet<String> nodeSet = RedisUtils.getClient().getSet(userNodeSetKey(userId));
        nodeSet.add(nodeId);
        RedisUtils.getClient().<Object>getSet(nodeUserSetKey(nodeId)).add(userId.toString());
        refreshNodeHeartbeat();
    }

    public static void unregisterUser(Long userId) {
        if (userId == null) {
            return;
        }
        String nodeId = currentNodeId();
        RSet<String> nodeSet = RedisUtils.getClient().getSet(userNodeSetKey(userId));
        nodeSet.remove(nodeId);
        if (nodeSet.isEmpty()) {
            nodeSet.delete();
        }
        RSet<Object> nodeUsers = RedisUtils.getClient().getSet(nodeUserSetKey(nodeId));
        removeNodeUserEntry(nodeUsers, userId);
        if (nodeUsers.isEmpty()) {
            nodeUsers.delete();
        }
    }

    /**
     * 根据当前 JVM 内真实在线会话，重新对齐当前节点的正反向注册信息。
     */
    public static void syncCurrentNodeUsers() {
        String nodeId = currentNodeId();
        RSet<Object> nodeUsers = RedisUtils.getClient().getSet(nodeUserSetKey(nodeId));
        Set<Long> localUsers = new LinkedHashSet<>(WebSocketSessionHolder.getSessionsAll());
        Set<Long> registeredUsers = normalizeUserIds(nodeUsers.readAll());

        localUsers.forEach(userId -> {
            RedisUtils.getClient().<String>getSet(userNodeSetKey(userId)).add(nodeId);
            nodeUsers.add(userId.toString());
        });

        registeredUsers.stream()
            .filter(userId -> !localUsers.contains(userId))
            .forEach(userId -> removeNodeRegistration(userId, nodeId));

        if (nodeUsers.isEmpty()) {
            nodeUsers.delete();
        }
    }

    /**
     * 主动清理已无心跳节点的反向索引和用户路由注册，避免脏注册长期残留。
     */
    public static void cleanupStaleNodeRegistrations() {
        Collection<String> nodeKeys = RedisUtils.keys(WEB_SOCKET_NODE_USER_SET_PREFIX + "*");
        for (String nodeKey : nodeKeys) {
            String nodeId = StrUtil.removePrefix(nodeKey, WEB_SOCKET_NODE_USER_SET_PREFIX);
            if (StrUtil.isBlank(nodeId) || isNodeAlive(nodeId)) {
                continue;
            }
            cleanupNodeRegistrations(nodeId);
        }
    }

    /**
     * 节点优雅下线时，主动移除本节点心跳与所有用户注册。
     */
    public static void unregisterCurrentNode() {
        String nodeId = currentNodeId();
        cleanupNodeRegistrations(nodeId);
        RedisUtils.deleteObject(nodeHeartbeatKey(nodeId));
    }

    static Map<String, List<Long>> routeSessionKeysByNode(List<Long> sessionKeys) {
        Map<String, List<Long>> routes = new LinkedHashMap<>();
        if (sessionKeys == null || sessionKeys.isEmpty()) {
            return routes;
        }
        for (Long sessionKey : new LinkedHashSet<>(sessionKeys)) {
            if (sessionKey == null) {
                continue;
            }
            RSet<String> nodeSet = RedisUtils.getClient().getSet(userNodeSetKey(sessionKey));
            Set<String> nodeIds = nodeSet.readAll();
            if (nodeIds == null || nodeIds.isEmpty()) {
                continue;
            }
            List<String> staleNodeIds = new ArrayList<>();
            for (String nodeId : nodeIds) {
                if (isNodeAlive(nodeId)) {
                    routes.computeIfAbsent(nodeId, key -> new ArrayList<>()).add(sessionKey);
                } else {
                    staleNodeIds.add(nodeId);
                }
            }
            if (!staleNodeIds.isEmpty()) {
                staleNodeIds.forEach(nodeSet::remove);
                if (nodeSet.isEmpty()) {
                    nodeSet.delete();
                }
                log.info("清理WebSocket失效节点注册, sessionKey={}, staleNodes={}", sessionKey, staleNodeIds);
            }
        }
        return routes;
    }

    static boolean isNodeAlive(String nodeId) {
        return StrUtil.isNotBlank(nodeId) && RedisUtils.isExistsObject(nodeHeartbeatKey(nodeId));
    }

    private static void cleanupNodeRegistrations(String nodeId) {
        RSet<Object> nodeUsers = RedisUtils.getClient().getSet(nodeUserSetKey(nodeId));
        Set<Long> userIds = normalizeUserIds(nodeUsers.readAll());
        userIds.forEach(userId -> removeNodeRegistration(userId, nodeId));
        if (!userIds.isEmpty()) {
            log.info("清理WebSocket节点用户注册, nodeId={}, userIds={}", nodeId, userIds.stream().sorted().collect(Collectors.toList()));
        }
        nodeUsers.delete();
    }

    private static void removeNodeRegistration(Long userId, String nodeId) {
        RSet<String> userNodes = RedisUtils.getClient().getSet(userNodeSetKey(userId));
        userNodes.remove(nodeId);
        if (userNodes.isEmpty()) {
            userNodes.delete();
        }
        if (StrUtil.equals(nodeId, currentNodeId())) {
            RSet<Object> nodeUsers = RedisUtils.getClient().getSet(nodeUserSetKey(nodeId));
            removeNodeUserEntry(nodeUsers, userId);
        }
    }

    private static Set<Long> normalizeUserIds(Collection<?> rawUserIds) {
        Set<Long> userIds = new LinkedHashSet<>();
        if (rawUserIds == null || rawUserIds.isEmpty()) {
            return userIds;
        }
        rawUserIds.stream()
            .map(Convert::toLong)
            .filter(value -> value != null)
            .forEach(userIds::add);
        return userIds;
    }

    private static void removeNodeUserEntry(RSet<Object> nodeUsers, Long userId) {
        if (userId == null) {
            return;
        }
        nodeUsers.remove(userId.toString());
        nodeUsers.remove(userId);
        Integer intValue = Convert.toInt(userId);
        if (intValue != null) {
            nodeUsers.remove(intValue);
        }
    }

    private static String resolveNodeId() {
        try {
            Environment environment = SpringUtils.getBean(Environment.class);
            String configuredNodeId = environment.getProperty("websocket.node-id");
            if (StrUtil.isNotBlank(configuredNodeId)) {
                return configuredNodeId.trim();
            }
            String applicationName = StrUtil.blankToDefault(environment.getProperty("spring.application.name"), "websocket-app");
            String port = StrUtil.blankToDefault(environment.getProperty("server.port"), "0");
            return applicationName + ":" + resolveHostName() + ":" + port + ":" + ManagementFactory.getRuntimeMXBean().getName();
        } catch (Exception ex) {
            log.warn("解析WebSocket节点标识失败，回退为随机节点ID", ex);
            return "websocket-node:" + IdUtil.fastSimpleUUID();
        }
    }

    private static String resolveHostName() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (Exception ex) {
            return "unknown-host";
        }
    }
}
