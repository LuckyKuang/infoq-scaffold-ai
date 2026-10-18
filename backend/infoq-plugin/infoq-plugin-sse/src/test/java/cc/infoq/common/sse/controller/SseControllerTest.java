package cc.infoq.common.sse.controller;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.exception.SseException;
import cc.infoq.common.security.auth.*;
import cc.infoq.common.sse.core.SseEmitterManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SseControllerTest {

    @Mock
    private SseEmitterManager sseEmitterManager;

    @Mock
    private SecurityTokenService tokenService;

    @Mock
    private CurrentUserService currentUserService;

    private final SecurityTokenResolver tokenResolver = new SecurityTokenResolver(new SecurityTokenProperties());

    @Test
    @DisplayName("connect: should throw when query token is missing")
    void connectShouldThrowWhenTokenMissing() {
        SseController controller = controller();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/sse");

        SseException exception = assertThrows(SseException.class, () -> controller.connect(request));

        assertEquals("认证失败，无法访问系统资源", exception.getMessage());
        verifyNoInteractions(sseEmitterManager);
        verifyNoInteractions(tokenService);
    }

    @Test
    @DisplayName("connect: should authenticate query token and delegate to emitter manager")
    void connectShouldAuthenticateQueryTokenAndDelegate() {
        SseController controller = controller();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/sse");
        request.addParameter("Authorization", "Bearer query-token");
        request.addParameter("clientid", "pc");
        SseEmitter emitter = new SseEmitter(1000L);
        LoginUser loginUser = loginUser(1L);
        when(tokenService.authenticate("query-token", "pc")).thenReturn(authentication("query-token", loginUser));
        when(sseEmitterManager.connect(1L, "query-token")).thenReturn(emitter);

        SseEmitter result = controller.connect(request);

        assertSame(emitter, result);
        verify(tokenService).authenticate("query-token", "pc");
        verify(sseEmitterManager).connect(1L, "query-token");
    }

    @Test
    @DisplayName("connect: should throw when token service rejects token")
    void connectShouldThrowWhenAuthenticationFails() {
        SseController controller = controller();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/sse");
        request.addParameter("Authorization", "Bearer revoked-token");
        request.addParameter("clientid", "pc");
        when(tokenService.authenticate("revoked-token", "pc"))
            .thenThrow(new SecurityAuthenticationException("token session is missing or revoked"));
        when(tokenService.shortDigest("revoked-token")).thenReturn("digest");

        SseException exception = assertThrows(SseException.class, () -> controller.connect(request));

        assertEquals("认证失败，无法访问系统资源", exception.getMessage());
        verifyNoInteractions(sseEmitterManager);
    }

    @Test
    @DisplayName("close: should disconnect current user and return success")
    void closeShouldDisconnectCurrentUser() {
        SseController controller = controller();
        when(currentUserService.getAuthentication()).thenReturn(authentication("current-token", loginUser(2L)));

        ApiResult<Void> result = controller.close();

        verify(sseEmitterManager).disconnect(2L, "current-token");
        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("close: should throw when current authentication is missing")
    void closeShouldThrowWhenAuthenticationMissing() {
        SseController controller = controller();
        when(currentUserService.getAuthentication())
            .thenThrow(new SecurityAuthenticationException("Spring Security authentication is missing"));

        SseException exception = assertThrows(SseException.class, controller::close);

        assertEquals("认证失败，无法访问系统资源", exception.getMessage());
        verifyNoInteractions(sseEmitterManager);
    }

    @Test
    @DisplayName("destroy: should not throw any exception")
    void destroyShouldNotThrow() {
        SseController controller = controller();
        assertDoesNotThrow(controller::destroy);
    }

    private SseController controller() {
        return new SseController(sseEmitterManager, tokenResolver, tokenService, currentUserService);
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
