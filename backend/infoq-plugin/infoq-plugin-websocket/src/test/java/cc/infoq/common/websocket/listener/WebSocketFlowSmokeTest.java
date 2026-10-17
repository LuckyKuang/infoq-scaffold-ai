package cc.infoq.common.websocket.listener;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.security.auth.*;
import cc.infoq.common.websocket.dto.WebSocketMessageDto;
import cc.infoq.common.websocket.handler.PlusWebSocketHandler;
import cc.infoq.common.websocket.holder.WebSocketSessionHolder;
import cc.infoq.common.websocket.interceptor.PlusWebSocketInterceptor;
import cc.infoq.common.websocket.utils.WebSocketClusterUtils;
import cc.infoq.common.websocket.utils.WebSocketUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import static cc.infoq.common.websocket.constant.WebSocketConstants.LOGIN_USER_KEY;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@Tag("dev")
class WebSocketFlowSmokeTest {

    @AfterEach
    void tearDown() {
        new ArrayList<>(WebSocketSessionHolder.getSessionsAll()).forEach(WebSocketSessionHolder::removeSession);
    }

    @Test
    @DisplayName("smoke: should complete handshake, exchange text message and cleanup websocket session")
    void smokeShouldCompleteHandshakeExchangeAndCleanup() throws Exception {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(501L);
        loginUser.setUserType("sys_user");

        SecurityTokenService tokenService = mock(SecurityTokenService.class);
        when(tokenService.authenticate("valid-token", "pc"))
            .thenReturn(authentication("valid-token", loginUser));
        PlusWebSocketInterceptor interceptor = new PlusWebSocketInterceptor(tokenResolver(), tokenService);
        PlusWebSocketHandler handler = new PlusWebSocketHandler();
        Map<String, Object> attributes = new HashMap<>();

        try (MockedStatic<WebSocketClusterUtils> clusterUtils = mockStatic(WebSocketClusterUtils.class)) {
            boolean handshakeOk = interceptor.beforeHandshake(
                handshakeRequest("valid-token", "pc"), mock(ServerHttpResponse.class), mock(WebSocketHandler.class), attributes);

            assertTrue(handshakeOk);
            assertEquals(loginUser, attributes.get(LOGIN_USER_KEY));

            WebSocketSession session = mock(WebSocketSession.class);
            when(session.getId()).thenReturn("smoke-session");
            when(session.getAttributes()).thenReturn(attributes);
            when(session.isOpen()).thenReturn(true);

            handler.afterConnectionEstablished(session);

            assertTrue(WebSocketSessionHolder.existSession(501L));
            assertEquals(1, WebSocketSessionHolder.sessionCount(501L));
            clusterUtils.verify(() -> WebSocketClusterUtils.registerUser(501L));

            WebSocketMessageDto publishedMessage;
            try (MockedStatic<WebSocketUtils> webSocketUtils = mockStatic(WebSocketUtils.class)) {
                invokeProtected(handler, "handleTextMessage", session, new TextMessage("smoke-payload"));

                ArgumentCaptor<WebSocketMessageDto> captor = ArgumentCaptor.forClass(WebSocketMessageDto.class);
                webSocketUtils.verify(() -> WebSocketUtils.publishMessage(captor.capture()));
                publishedMessage = captor.getValue();
            }

            assertEquals("smoke-payload", publishedMessage.getMessage());
            assertEquals(java.util.List.of(501L), publishedMessage.getSessionKeys());

            new WebSocketTopicListener().dispatchMessage(publishedMessage);

            verify(session).sendMessage(argThat(message ->
                message instanceof TextMessage text && "smoke-payload".equals(text.getPayload())));

            assertDoesNotThrow(() -> handler.handleTransportError(session, new RuntimeException("transport")));

            handler.afterConnectionClosed(session, CloseStatus.NORMAL);

            assertFalse(WebSocketSessionHolder.existSession(501L));
            clusterUtils.verify(() -> WebSocketClusterUtils.unregisterUser(501L));
        }
    }

    @Test
    @DisplayName("smoke: should reject handshake and swallow downstream send exception")
    void smokeShouldRejectInvalidHandshakeAndSwallowSendException() throws Exception {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(502L);
        loginUser.setUserType("sys_user");

        SecurityTokenService tokenService = mock(SecurityTokenService.class);
        when(tokenService.authenticate("invalid-token", "pc"))
            .thenThrow(new SecurityAuthenticationException("token session is missing or revoked"));
        when(tokenService.shortDigest("invalid-token")).thenReturn("digest");
        PlusWebSocketInterceptor interceptor = new PlusWebSocketInterceptor(tokenResolver(), tokenService);
        Map<String, Object> rejectedAttributes = new HashMap<>();

        boolean handshakeOk = interceptor.beforeHandshake(
            handshakeRequest("invalid-token", "pc"), mock(ServerHttpResponse.class), mock(WebSocketHandler.class), rejectedAttributes);

        assertFalse(handshakeOk);
        assertTrue(rejectedAttributes.isEmpty());

        PlusWebSocketHandler handler = new PlusWebSocketHandler();
        WebSocketSession brokenSession = mock(WebSocketSession.class);
        Map<String, Object> attributes = new HashMap<>();
        attributes.put(LOGIN_USER_KEY, loginUser);
        when(brokenSession.getId()).thenReturn("broken-session");
        when(brokenSession.getAttributes()).thenReturn(attributes);
        when(brokenSession.isOpen()).thenReturn(true);
        doThrow(new java.io.IOException("broken pipe")).when(brokenSession).sendMessage(any(TextMessage.class));

        try (MockedStatic<WebSocketClusterUtils> clusterUtils = mockStatic(WebSocketClusterUtils.class)) {
            handler.afterConnectionEstablished(brokenSession);

            WebSocketMessageDto dto = new WebSocketMessageDto();
            dto.setSessionKeys(java.util.List.of(502L));
            dto.setMessage("should-not-escape");

            assertDoesNotThrow(() -> new WebSocketTopicListener().dispatchMessage(dto));

            handler.afterConnectionClosed(brokenSession, CloseStatus.NORMAL);
            clusterUtils.verify(() -> WebSocketClusterUtils.registerUser(502L));
            clusterUtils.verify(() -> WebSocketClusterUtils.unregisterUser(502L));
        }
    }

    private static SecurityTokenResolver tokenResolver() {
        return new SecurityTokenResolver(new SecurityTokenProperties());
    }

    private static ServerHttpRequest handshakeRequest(String token, String clientId) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/resource/websocket");
        request.addHeader("Authorization", "Bearer " + token);
        request.addHeader("clientid", clientId);
        return new ServletServerHttpRequest(request);
    }

    private static SecurityTokenAuthentication authentication(String token, LoginUser loginUser) {
        SecurityTokenSession session = new SecurityTokenSession();
        session.setLoginUser(loginUser);
        return new SecurityTokenAuthentication(token, "digest", null, session);
    }

    private static void invokeProtected(PlusWebSocketHandler handler, String method, Object... args) throws Exception {
        Class<?>[] types = new Class<?>[args.length];
        for (int i = 0; i < args.length; i++) {
            types[i] = args[i].getClass();
            if (args[i] instanceof WebSocketSession) {
                types[i] = WebSocketSession.class;
            }
            if (args[i] instanceof TextMessage) {
                types[i] = TextMessage.class;
            }
        }
        Method target = PlusWebSocketHandler.class.getDeclaredMethod(method, types);
        target.setAccessible(true);
        target.invoke(handler, args);
    }
}
