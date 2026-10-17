package cc.infoq.common.websocket.utils;

import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.websocket.dto.WebSocketMessageDto;
import cc.infoq.common.websocket.holder.WebSocketSessionHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.redisson.api.RTopic;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class WebSocketUtilsTest {

    private static RedissonClient redissonClient;
    private static final Map<String, RTopic> TOPICS = new HashMap<>();

    @BeforeAll
    static void initSpringContext() {
        RedissonClient redissonClientBean = mock(RedissonClient.class);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> redissonClientBean);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        redissonClient = RedisUtils.getClient();
    }

    @BeforeEach
    void resetRedisMocks() {
        reset(redissonClient);
        TOPICS.clear();
        when(redissonClient.getTopic(anyString())).thenAnswer(invocation ->
            TOPICS.computeIfAbsent(invocation.getArgument(0), key -> mock(RTopic.class)));
    }

    @AfterEach
    void clearSessions() {
        List<Long> keys = new ArrayList<>(WebSocketSessionHolder.getSessionsAll());
        keys.forEach(WebSocketSessionHolder::removeSession);
    }

    @Test
    @DisplayName("sendMessage(sessionKey): should fan out to all local sessions of the same user")
    void sendMessageBySessionKeyShouldFanOutToAllSessions() throws IOException {
        WebSocketSession sessionA = mock(WebSocketSession.class);
        when(sessionA.getId()).thenReturn("a");
        when(sessionA.isOpen()).thenReturn(true);
        WebSocketSession sessionB = mock(WebSocketSession.class);
        when(sessionB.getId()).thenReturn("b");
        when(sessionB.isOpen()).thenReturn(true);
        WebSocketSessionHolder.addSession(1L, sessionA);
        WebSocketSessionHolder.addSession(1L, sessionB);

        WebSocketUtils.sendMessage(1L, "hello");

        verify(sessionA).sendMessage(Mockito.argThat((WebSocketMessage<?> message) ->
            message instanceof TextMessage text && "hello".equals(text.getPayload())));
        verify(sessionB).sendMessage(Mockito.argThat((WebSocketMessage<?> message) ->
            message instanceof TextMessage text && "hello".equals(text.getPayload())));
    }

    @Test
    @DisplayName("sendMessage/sendPongMessage: should tolerate closed session and io exception")
    void sendMessageShouldTolerateClosedSessionAndIoException() throws IOException {
        WebSocketSession closed = mock(WebSocketSession.class);
        when(closed.isOpen()).thenReturn(false);
        assertDoesNotThrow(() -> WebSocketUtils.sendMessage(closed, "ignore"));

        WebSocketSession broken = mock(WebSocketSession.class);
        when(broken.isOpen()).thenReturn(true);
        Mockito.doThrow(new IOException("network down")).when(broken).sendMessage(any(TextMessage.class));
        assertDoesNotThrow(() -> WebSocketUtils.sendMessage(broken, "payload"));

        WebSocketSession pongSession = mock(WebSocketSession.class);
        when(pongSession.isOpen()).thenReturn(true);
        WebSocketUtils.sendPongMessage(pongSession);
        verify(pongSession).sendMessage(any(PongMessage.class));
    }

    @Test
    @DisplayName("publishMessage: should publish grouped users to node topics")
    void publishMessageShouldPublishGroupedUsersToNodeTopics() {
        WebSocketMessageDto dto = new WebSocketMessageDto();
        dto.setMessage("cluster");
        dto.setSessionKeys(List.of(1L, 2L));

        Map<String, List<Long>> routed = new LinkedHashMap<>();
        routed.put("node-a", List.of(1L));
        routed.put("node-b", List.of(1L, 2L));

        try (MockedStatic<WebSocketClusterUtils> clusterUtils = Mockito.mockStatic(WebSocketClusterUtils.class)) {
            clusterUtils.when(() -> WebSocketClusterUtils.routeSessionKeysByNode(List.of(1L, 2L))).thenReturn(routed);
            clusterUtils.when(() -> WebSocketClusterUtils.nodeTopic("node-a")).thenReturn("global:websocket:node:node-a");
            clusterUtils.when(() -> WebSocketClusterUtils.nodeTopic("node-b")).thenReturn("global:websocket:node:node-b");

            WebSocketUtils.publishMessage(dto);

            ArgumentCaptor<WebSocketMessageDto> captor = ArgumentCaptor.forClass(WebSocketMessageDto.class);
            verify(TOPICS.get("global:websocket:node:node-a")).publish(captor.capture());
            assertEquals("cluster", captor.getValue().getMessage());
            assertEquals(List.of(1L), captor.getValue().getSessionKeys());

            ArgumentCaptor<WebSocketMessageDto> secondCaptor = ArgumentCaptor.forClass(WebSocketMessageDto.class);
            verify(TOPICS.get("global:websocket:node:node-b")).publish(secondCaptor.capture());
            assertEquals("cluster", secondCaptor.getValue().getMessage());
            assertEquals(List.of(1L, 2L), secondCaptor.getValue().getSessionKeys());
        }
    }

    @Test
    @DisplayName("publishAll/subscribeMessage/subscribeNodeMessage: should delegate to redis utilities")
    void publishAndSubscribeShouldDelegateToRedisUtils() {
        Consumer<WebSocketMessageDto> consumer = message -> {
        };

        try (MockedStatic<WebSocketClusterUtils> clusterUtils = Mockito.mockStatic(WebSocketClusterUtils.class)) {
            clusterUtils.when(WebSocketClusterUtils::currentNodeTopic).thenReturn("global:websocket:node:test-node");

            WebSocketUtils.publishAll("all");
            WebSocketUtils.subscribeMessage(consumer);
            WebSocketUtils.subscribeNodeMessage(consumer);

            ArgumentCaptor<WebSocketMessageDto> captor = ArgumentCaptor.forClass(WebSocketMessageDto.class);
            verify(TOPICS.get("global:websocket")).publish(captor.capture());
            assertEquals("all", captor.getValue().getMessage());
            verify(TOPICS.get("global:websocket")).addListener(Mockito.eq(WebSocketMessageDto.class), any());
            verify(TOPICS.get("global:websocket:node:test-node")).addListener(Mockito.eq(WebSocketMessageDto.class), any());
        }
    }
}
