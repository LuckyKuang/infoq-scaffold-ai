package cc.infoq.common.websocket.interceptor;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.security.auth.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.socket.WebSocketHandler;

import java.util.HashMap;
import java.util.Map;

import static cc.infoq.common.websocket.constant.WebSocketConstants.LOGIN_USER_KEY;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Tag("dev")
@ExtendWith(MockitoExtension.class)
class PlusWebSocketInterceptorTest {

    @Mock
    private SecurityTokenService tokenService;

    private final SecurityTokenResolver tokenResolver = new SecurityTokenResolver(new SecurityTokenProperties());

    @Test
    @DisplayName("beforeHandshake: should put login user when header token and client id are valid")
    void beforeHandshakeShouldSucceedWithHeaderToken() {
        PlusWebSocketInterceptor interceptor = interceptor();
        LoginUser loginUser = loginUser(8L);
        MockHttpServletRequest servletRequest = request();
        servletRequest.addHeader("Authorization", "Bearer header-token");
        servletRequest.addHeader("clientid", "pc");
        when(tokenService.authenticate("header-token", "pc")).thenReturn(authentication("header-token", loginUser));
        Map<String, Object> attributes = new HashMap<>();

        boolean ok = interceptor.beforeHandshake(
            new ServletServerHttpRequest(servletRequest), mock(ServerHttpResponse.class), mock(WebSocketHandler.class), attributes);

        assertTrue(ok);
        assertEquals(loginUser, attributes.get(LOGIN_USER_KEY));
        verify(tokenService).authenticate("header-token", "pc");
    }

    @Test
    @DisplayName("beforeHandshake: should put login user when query token and client id are valid")
    void beforeHandshakeShouldSucceedWithQueryToken() {
        PlusWebSocketInterceptor interceptor = interceptor();
        LoginUser loginUser = loginUser(9L);
        MockHttpServletRequest servletRequest = request();
        servletRequest.addParameter("Authorization", "Bearer query-token");
        servletRequest.addParameter("clientid", "h5");
        when(tokenService.authenticate("query-token", "h5")).thenReturn(authentication("query-token", loginUser));
        Map<String, Object> attributes = new HashMap<>();

        boolean ok = interceptor.beforeHandshake(
            new ServletServerHttpRequest(servletRequest), mock(ServerHttpResponse.class), mock(WebSocketHandler.class), attributes);

        assertTrue(ok);
        assertEquals(loginUser, attributes.get(LOGIN_USER_KEY));
        verify(tokenService).authenticate("query-token", "h5");
    }

    @Test
    @DisplayName("beforeHandshake: should return false when token is missing")
    void beforeHandshakeShouldReturnFalseWhenTokenMissing() {
        PlusWebSocketInterceptor interceptor = interceptor();
        Map<String, Object> attributes = new HashMap<>();

        boolean ok = interceptor.beforeHandshake(
            new ServletServerHttpRequest(request()), mock(ServerHttpResponse.class), mock(WebSocketHandler.class), attributes);

        assertFalse(ok);
        assertTrue(attributes.isEmpty());
        verifyNoInteractions(tokenService);
    }

    @Test
    @DisplayName("beforeHandshake: should return false when client id is missing")
    void beforeHandshakeShouldReturnFalseWhenClientIdMissing() {
        PlusWebSocketInterceptor interceptor = interceptor();
        MockHttpServletRequest servletRequest = request();
        servletRequest.addHeader("Authorization", "Bearer header-token");
        when(tokenService.shortDigest("header-token")).thenReturn("digest");

        boolean ok = interceptor.beforeHandshake(
            new ServletServerHttpRequest(servletRequest), mock(ServerHttpResponse.class), mock(WebSocketHandler.class), new HashMap<>());

        assertFalse(ok);
        verify(tokenService, never()).authenticate(anyString(), anyString());
    }

    @Test
    @DisplayName("beforeHandshake: should return false when token service rejects token")
    void beforeHandshakeShouldReturnFalseWhenAuthenticationFails() {
        PlusWebSocketInterceptor interceptor = interceptor();
        MockHttpServletRequest servletRequest = request();
        servletRequest.addHeader("Authorization", "Bearer revoked-token");
        servletRequest.addHeader("clientid", "pc");
        when(tokenService.authenticate("revoked-token", "pc"))
            .thenThrow(new SecurityAuthenticationException("token session is missing or revoked"));
        when(tokenService.shortDigest("revoked-token")).thenReturn("digest");

        boolean ok = interceptor.beforeHandshake(
            new ServletServerHttpRequest(servletRequest), mock(ServerHttpResponse.class), mock(WebSocketHandler.class), new HashMap<>());

        assertFalse(ok);
    }

    @Test
    @DisplayName("afterHandshake: should be no-op")
    void afterHandshakeShouldBeNoOp() {
        PlusWebSocketInterceptor interceptor = interceptor();
        assertDoesNotThrow(() -> interceptor.afterHandshake(
            mock(ServerHttpRequest.class), mock(ServerHttpResponse.class), mock(WebSocketHandler.class), null));
    }

    private PlusWebSocketInterceptor interceptor() {
        return new PlusWebSocketInterceptor(tokenResolver, tokenService);
    }

    private static MockHttpServletRequest request() {
        return new MockHttpServletRequest("GET", "/resource/websocket");
    }

    private static LoginUser loginUser(Long userId) {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(userId);
        loginUser.setUserType("sys_user");
        return loginUser;
    }

    private static SecurityTokenAuthentication authentication(String token, LoginUser loginUser) {
        SecurityTokenSession session = new SecurityTokenSession();
        session.setLoginUser(loginUser);
        return new SecurityTokenAuthentication(token, "digest", null, session);
    }
}
