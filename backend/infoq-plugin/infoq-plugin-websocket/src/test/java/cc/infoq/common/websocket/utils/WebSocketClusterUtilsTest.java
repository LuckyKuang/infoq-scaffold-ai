package cc.infoq.common.websocket.utils;

import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.websocket.holder.WebSocketSessionHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.redisson.api.RBucket;
import org.redisson.api.RKeys;
import org.redisson.api.RSet;
import org.redisson.api.RedissonClient;
import org.redisson.api.options.KeysScanOptions;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.web.socket.WebSocketSession;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class WebSocketClusterUtilsTest {

    private static RedissonClient redissonClient;
    private static RKeys rKeys;
    private static final Map<String, RSet<String>> STRING_SETS = new HashMap<>();
    private static final Map<String, RSet<Object>> NODE_USER_SETS = new HashMap<>();
    private static final Map<String, RBucket<Object>> BUCKETS = new HashMap<>();

    @BeforeAll
    static void initSpringContext() {
        RedissonClient redissonClientBean = mock(RedissonClient.class);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> redissonClientBean);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        redissonClient = RedisUtils.getClient();
        rKeys = mock(RKeys.class);
    }

    @BeforeEach
    void resetRedisMocks() {
        reset(redissonClient, rKeys);
        STRING_SETS.clear();
        NODE_USER_SETS.clear();
        BUCKETS.clear();

        when(redissonClient.getKeys()).thenReturn(rKeys);
        when(rKeys.getKeysStream(any(KeysScanOptions.class))).thenReturn(Stream.empty());
        when(redissonClient.getSet(anyString())).thenAnswer(invocation -> {
            String key = invocation.getArgument(0);
            if (key.startsWith("global:websocket:user:nodes:")) {
                return STRING_SETS.computeIfAbsent(key, ignored -> mock(RSet.class));
            }
            return NODE_USER_SETS.computeIfAbsent(key, ignored -> mock(RSet.class));
        });
        when(redissonClient.getBucket(anyString())).thenAnswer(invocation ->
            BUCKETS.computeIfAbsent(invocation.getArgument(0), ignored -> mock(RBucket.class)));
    }

    @AfterEach
    void clearSessions() {
        new ArrayList<>(WebSocketSessionHolder.getSessionsAll()).forEach(WebSocketSessionHolder::removeSession);
    }

    @Test
    @DisplayName("registerUser: should add current node to shared registry, reverse index and heartbeat")
    void registerUserShouldAddCurrentNodeToSharedRegistryAndRefreshHeartbeat() {
        String currentNodeId = WebSocketClusterUtils.currentNodeId();
        @SuppressWarnings("unchecked")
        RSet<String> nodeSet = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RSet<Object> nodeUsers = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RBucket<Object> heartbeatBucket = mock(RBucket.class);
        STRING_SETS.put(WebSocketClusterUtils.userNodeSetKey(1L), nodeSet);
        NODE_USER_SETS.put(WebSocketClusterUtils.nodeUserSetKey(currentNodeId), nodeUsers);
        BUCKETS.put(WebSocketClusterUtils.nodeHeartbeatKey(currentNodeId), heartbeatBucket);

        WebSocketClusterUtils.registerUser(1L);

        verify(nodeSet).add(currentNodeId);
        verify(nodeUsers).add("1");
        verify(heartbeatBucket).set(currentNodeId, Duration.ofSeconds(90L));
    }

    @Test
    @DisplayName("unregisterUser: should remove current node from shared registry and reverse index")
    void unregisterUserShouldRemoveCurrentNodeAndDeleteEmptyRegistryKey() {
        String currentNodeId = WebSocketClusterUtils.currentNodeId();
        @SuppressWarnings("unchecked")
        RSet<String> nodeSet = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RSet<Object> nodeUsers = mock(RSet.class);
        when(nodeSet.isEmpty()).thenReturn(true);
        when(nodeUsers.isEmpty()).thenReturn(true);
        STRING_SETS.put(WebSocketClusterUtils.userNodeSetKey(2L), nodeSet);
        NODE_USER_SETS.put(WebSocketClusterUtils.nodeUserSetKey(currentNodeId), nodeUsers);

        WebSocketClusterUtils.unregisterUser(2L);

        verify(nodeSet).remove(currentNodeId);
        verify(nodeSet).delete();
        verify(nodeUsers).remove("2");
        verify(nodeUsers).delete();
    }

    @Test
    @DisplayName("syncCurrentNodeUsers: should reconcile local sessions with forward and reverse registry")
    void syncCurrentNodeUsersShouldReconcileLocalSessions() {
        WebSocketSession sessionA = mock(WebSocketSession.class);
        when(sessionA.getId()).thenReturn("a");
        WebSocketSession sessionB = mock(WebSocketSession.class);
        when(sessionB.getId()).thenReturn("b");
        WebSocketSessionHolder.addSession(10L, sessionA);
        WebSocketSessionHolder.addSession(11L, sessionB);

        String currentNodeId = WebSocketClusterUtils.currentNodeId();
        @SuppressWarnings("unchecked")
        RSet<Object> nodeUsers = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RSet<String> user10Nodes = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RSet<String> user11Nodes = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RSet<String> user12Nodes = mock(RSet.class);
        when(nodeUsers.readAll()).thenReturn(Set.of("10", 12));
        when(nodeUsers.isEmpty()).thenReturn(false);
        when(user12Nodes.isEmpty()).thenReturn(true);
        NODE_USER_SETS.put(WebSocketClusterUtils.nodeUserSetKey(currentNodeId), nodeUsers);
        STRING_SETS.put(WebSocketClusterUtils.userNodeSetKey(10L), user10Nodes);
        STRING_SETS.put(WebSocketClusterUtils.userNodeSetKey(11L), user11Nodes);
        STRING_SETS.put(WebSocketClusterUtils.userNodeSetKey(12L), user12Nodes);

        WebSocketClusterUtils.syncCurrentNodeUsers();

        verify(user10Nodes).add(currentNodeId);
        verify(user11Nodes).add(currentNodeId);
        verify(nodeUsers).add("10");
        verify(nodeUsers).add("11");
        verify(user12Nodes).remove(currentNodeId);
        verify(user12Nodes).delete();
        verify(nodeUsers).remove("12");
    }

    @Test
    @DisplayName("cleanupStaleNodeRegistrations: should remove dead node from all users and delete reverse index")
    void cleanupStaleNodeRegistrationsShouldRemoveDeadNodeFromUsers() {
        @SuppressWarnings("unchecked")
        RSet<Object> deadNodeUsers = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RSet<String> user1Nodes = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RSet<String> user2Nodes = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RBucket<Object> deadHeartbeat = mock(RBucket.class);
        when(rKeys.getKeysStream(any(KeysScanOptions.class))).thenReturn(Stream.of(WebSocketClusterUtils.nodeUserSetKey("node-dead")));
        when(deadNodeUsers.readAll()).thenReturn(Set.of("1", 2));
        when(user1Nodes.isEmpty()).thenReturn(false);
        when(user2Nodes.isEmpty()).thenReturn(true);
        when(deadHeartbeat.isExists()).thenReturn(false);
        NODE_USER_SETS.put(WebSocketClusterUtils.nodeUserSetKey("node-dead"), deadNodeUsers);
        STRING_SETS.put(WebSocketClusterUtils.userNodeSetKey(1L), user1Nodes);
        STRING_SETS.put(WebSocketClusterUtils.userNodeSetKey(2L), user2Nodes);
        BUCKETS.put(WebSocketClusterUtils.nodeHeartbeatKey("node-dead"), deadHeartbeat);

        WebSocketClusterUtils.cleanupStaleNodeRegistrations();

        verify(user1Nodes).remove("node-dead");
        verify(user2Nodes).remove("node-dead");
        verify(user2Nodes).delete();
        verify(deadNodeUsers).delete();
    }

    @Test
    @DisplayName("routeSessionKeysByNode: should group users by alive nodes and remove stale nodes")
    void routeSessionKeysByNodeShouldGroupUsersByAliveNodesAndRemoveStaleNodes() {
        @SuppressWarnings("unchecked")
        RSet<String> user1Nodes = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RSet<String> user2Nodes = mock(RSet.class);
        @SuppressWarnings("unchecked")
        RBucket<Object> nodeABucket = mock(RBucket.class);
        @SuppressWarnings("unchecked")
        RBucket<Object> nodeBBucket = mock(RBucket.class);
        @SuppressWarnings("unchecked")
        RBucket<Object> nodeDeadBucket = mock(RBucket.class);

        STRING_SETS.put(WebSocketClusterUtils.userNodeSetKey(1L), user1Nodes);
        STRING_SETS.put(WebSocketClusterUtils.userNodeSetKey(2L), user2Nodes);
        BUCKETS.put(WebSocketClusterUtils.nodeHeartbeatKey("node-a"), nodeABucket);
        BUCKETS.put(WebSocketClusterUtils.nodeHeartbeatKey("node-b"), nodeBBucket);
        BUCKETS.put(WebSocketClusterUtils.nodeHeartbeatKey("node-dead"), nodeDeadBucket);

        when(user1Nodes.readAll()).thenReturn(Set.of("node-a", "node-dead"));
        when(user2Nodes.readAll()).thenReturn(Set.of("node-b"));
        when(user1Nodes.isEmpty()).thenReturn(false);
        when(nodeABucket.isExists()).thenReturn(true);
        when(nodeBBucket.isExists()).thenReturn(true);
        when(nodeDeadBucket.isExists()).thenReturn(false);

        Map<String, List<Long>> routed = WebSocketClusterUtils.routeSessionKeysByNode(List.of(1L, 2L));

        assertEquals(List.of(1L), routed.get("node-a"));
        assertEquals(List.of(2L), routed.get("node-b"));
        verify(user1Nodes).remove("node-dead");
    }

    @Test
    @DisplayName("routeSessionKeysByNode: should ignore empty input")
    void routeSessionKeysByNodeShouldIgnoreEmptyInput() {
        Map<String, List<Long>> routed = WebSocketClusterUtils.routeSessionKeysByNode(List.of());
        assertTrue(routed.isEmpty());
    }
}
