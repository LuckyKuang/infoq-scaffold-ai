package cc.infoq.system.listener;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.log.event.LoginInfoEvent;
import cc.infoq.common.security.auth.SecurityTokenSession;
import cc.infoq.common.utils.ServletUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.utils.ip.AddressUtils;
import cc.infoq.system.service.SysLoginService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.redisson.api.RedissonClient;
import org.springframework.context.ApplicationEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.PayloadApplicationEvent;
import org.springframework.context.support.GenericApplicationContext;

import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.*;

@Tag("dev")
class UserActionListenerTest {

    @BeforeEach
    void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> org.mockito.Mockito.mock(RedissonClient.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("listener: should not implement legacy listener callbacks")
    void listenerShouldNotImplementLegacyCallbacks() {
        assertEquals(0, UserActionListener.class.getInterfaces().length);
    }

    @Test
    @DisplayName("buildOnlineUser: should build token-store metadata from login user and request")
    void buildOnlineUserShouldBuildTokenStoreMetadata() {
        UserActionListener listener = new UserActionListener(mock(SysLoginService.class));
        LoginUser loginUser = loginUser();
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("User-Agent"))
            .thenReturn("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");

        try (MockedStatic<ServletUtils> servletUtils = mockStatic(ServletUtils.class);
             MockedStatic<AddressUtils> addressUtils = mockStatic(AddressUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            servletUtils.when(ServletUtils::getClientIP).thenReturn("127.0.0.1");
            addressUtils.when(() -> AddressUtils.getRealAddressByIP("127.0.0.1")).thenReturn("内网IP");

            UserOnlineDTO dto = listener.buildOnlineUser(loginUser, "admin-client", "pc");

            assertEquals("admin", dto.getUserName());
            assertEquals("研发中心", dto.getDeptName());
            assertEquals("admin-client", dto.getClientKey());
            assertEquals("pc", dto.getDeviceType());
            assertEquals("127.0.0.1", dto.getIpaddr());
            assertEquals("内网IP", dto.getLoginLocation());
            assertEquals("Chrome", dto.getBrowser());
            assertNotNull(dto.getLoginTime());
            assertEquals("admin-client", loginUser.getClientKey());
            assertEquals("pc", loginUser.getDeviceType());
            assertEquals("内网IP", loginUser.getLoginLocation());
        }
    }

    @Test
    @DisplayName("buildOnlineUser: should prefer runtime mini-program headers")
    void buildOnlineUserShouldPreferRuntimeHeadersForOnlineMetadata() {
        UserActionListener listener = new UserActionListener(mock(SysLoginService.class));
        LoginUser loginUser = loginUser();
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("User-Agent"))
            .thenReturn("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36");
        when(request.getHeader("x-client-key")).thenReturn("miniapp");
        when(request.getHeader("x-device-type")).thenReturn("miniapp");

        try (MockedStatic<ServletUtils> servletUtils = mockStatic(ServletUtils.class);
             MockedStatic<AddressUtils> addressUtils = mockStatic(AddressUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenReturn(request);
            servletUtils.when(ServletUtils::getClientIP).thenReturn("127.0.0.1");
            addressUtils.when(() -> AddressUtils.getRealAddressByIP("127.0.0.1")).thenReturn("内网IP");

            UserOnlineDTO dto = listener.buildOnlineUser(loginUser, "admin-client", "pc");

            assertEquals("miniapp", dto.getClientKey());
            assertEquals("miniapp", dto.getDeviceType());
            assertEquals("miniapp", loginUser.getClientKey());
            assertEquals("miniapp", loginUser.getDeviceType());
        }
    }

    @Test
    @DisplayName("recordLoginSuccess: should publish login event and update latest login info")
    void recordLoginSuccessShouldPublishEventAndUpdateLoginInfo() {
        SysLoginService loginService = mock(SysLoginService.class);
        UserActionListener listener = new UserActionListener(loginService);
        LoginUser loginUser = loginUser();
        loginUser.setIpaddr("127.0.0.1");
        AtomicReference<LoginInfoEvent> eventRef = new AtomicReference<>();
        ApplicationListener<ApplicationEvent> applicationListener = event -> {
            if (event instanceof PayloadApplicationEvent<?> payloadEvent
                && payloadEvent.getPayload() instanceof LoginInfoEvent loginInfoEvent) {
                eventRef.set(loginInfoEvent);
            }
        };
        ((GenericApplicationContext) SpringUtils.context()).addApplicationListener(applicationListener);

        listener.recordLoginSuccess(loginUser);

        verify(loginService).recordLoginInfo(100L, "127.0.0.1");
        LoginInfoEvent event = eventRef.get();
        assertNotNull(event);
        assertEquals("admin", event.getUsername());
        assertEquals(Constants.LOGIN_SUCCESS, event.getStatus());
    }

    @Test
    @DisplayName("recordLoginSuccess(session): should attach online metadata for token-store callers")
    void recordLoginSuccessSessionShouldAttachOnlineMetadata() {
        SysLoginService loginService = mock(SysLoginService.class);
        UserActionListener listener = new UserActionListener(loginService);
        SecurityTokenSession session = new SecurityTokenSession();
        session.setAccessToken("token-abc");
        session.setClientId("admin-client");
        session.setDeviceType("pc");
        session.setLoginUser(loginUser());

        try (MockedStatic<ServletUtils> servletUtils = mockStatic(ServletUtils.class);
             MockedStatic<AddressUtils> addressUtils = mockStatic(AddressUtils.class)) {
            servletUtils.when(ServletUtils::getRequest).thenThrow(new IllegalStateException("no request"));
            addressUtils.when(() -> AddressUtils.getRealAddressByIP("")).thenReturn("");

            listener.recordLoginSuccess(session);

            assertNotNull(session.getOnlineUser());
            assertEquals("token-abc", session.getOnlineUser().getTokenId());
            verify(loginService).recordLoginInfo(100L, "");
        }
    }

    private LoginUser loginUser() {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(100L);
        loginUser.setUserType("sys_user");
        loginUser.setUsername("admin");
        loginUser.setDeptName("研发中心");
        return loginUser;
    }
}
