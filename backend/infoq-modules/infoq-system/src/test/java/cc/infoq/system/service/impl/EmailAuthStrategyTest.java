package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.enums.EmailCodeScene;
import cc.infoq.common.enums.LoginType;
import cc.infoq.common.exception.user.UserException;
import cc.infoq.common.security.auth.SecurityIssuedToken;
import cc.infoq.common.security.auth.SecurityTokenIssueRequest;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.listener.UserActionListener;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.AuthEmailCodeService;
import cc.infoq.system.service.SysLoginService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class EmailAuthStrategyTest {

    private GenericApplicationContext context;

    @Mock
    private SysLoginService loginService;
    @Mock
    private SysUserMapper userMapper;
    @Mock
    private AuthEmailCodeService authEmailCodeService;
    @Mock
    private SecurityTokenService tokenService;
    @Mock
    private UserActionListener userActionListener;

    @BeforeEach
    void initSpringContext() {
        context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.registerBean(Validator.class, () -> Validation.buildDefaultValidatorFactory().getValidator());
        context.registerBean(RedissonClient.class, () -> org.mockito.Mockito.mock(RedissonClient.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @AfterEach
    void tearDown() {
        if (context != null) {
            context.close();
        }
    }

    @Test
    @DisplayName("loadUserByEmail: should throw when user does not exist")
    void loadUserByEmailShouldThrowWhenUserNotExists() throws Exception {
        EmailAuthStrategy strategy = new EmailAuthStrategy(loginService, userMapper, authEmailCodeService, tokenService, userActionListener);
        when(userMapper.selectVoOne(any())).thenReturn(null);

        Method method = EmailAuthStrategy.class.getDeclaredMethod("loadUserByEmail", String.class);
        method.setAccessible(true);
        InvocationTargetException ex = assertThrows(InvocationTargetException.class, () -> method.invoke(strategy, "a@b.com"));

        assertTrue(ex.getCause() instanceof UserException);
    }

    @Test
    @DisplayName("login: should throw when user is disabled")
    void loginShouldThrowWhenUserDisabled() {
        EmailAuthStrategy strategy = new EmailAuthStrategy(loginService, userMapper, authEmailCodeService, tokenService, userActionListener);
        SysUserVo user = new SysUserVo();
        user.setEmail("a@b.com");
        user.setStatus(SystemConstants.DISABLE);
        when(userMapper.selectVoOne(any())).thenReturn(user);

        assertThrows(UserException.class, () -> strategy.login(emailBody("a@b.com", "1234"), buildClient()));
    }

    @Test
    @DisplayName("login: should return token when email code is valid")
    void loginShouldReturnTokenWhenEmailCodeValid() {
        EmailAuthStrategy strategy = new EmailAuthStrategy(loginService, userMapper, authEmailCodeService, tokenService, userActionListener);
        SysUserVo user = new SysUserVo();
        user.setEmail("a@b.com");
        user.setUserName("admin");
        user.setStatus(SystemConstants.NORMAL);
        when(userMapper.selectVoOne(any())).thenReturn(user);

        LoginUser loginUser = loginUser();
        when(loginService.buildLoginUser(user)).thenReturn(loginUser);
        when(authEmailCodeService.validateCode(EmailCodeScene.EMAIL_LOGIN, "a@b.com", "1234")).thenReturn(true);
        doAnswer(invocation -> {
            Supplier<?> supplier = invocation.getArgument(2);
            assertEquals(Boolean.FALSE, supplier.get());
            return null;
        }).when(loginService).checkLogin(eq(LoginType.EMAIL), eq("admin"), any());

        when(tokenService.issue(any(SecurityTokenIssueRequest.class)))
            .thenReturn(new SecurityIssuedToken("email-token", 3600L, "digest-1", "jwt-1"));
        when(userActionListener.buildOnlineUser(eq(loginUser), eq("pc"), eq("web"))).thenReturn(new UserOnlineDTO());

        LoginVo result = strategy.login(emailBody("a@b.com", "1234"), buildClient());

        assertEquals("email-token", result.getAccessToken());
        assertEquals(3600L, result.getExpireIn());
        assertEquals("pc", result.getClientId());
        assertEquals("client-key", loginUser.getClientKey());
        assertEquals("web", loginUser.getDeviceType());
        ArgumentCaptor<SecurityTokenIssueRequest> requestCaptor = ArgumentCaptor.forClass(SecurityTokenIssueRequest.class);
        verify(tokenService).issue(requestCaptor.capture());
        SecurityTokenIssueRequest request = requestCaptor.getValue();
        assertSame(loginUser, request.loginUser());
        assertEquals("pc", request.clientId());
        assertEquals("web", request.deviceType());
        assertEquals(3600L, request.timeoutSeconds());
        assertEquals(1200L, request.activeTimeoutSeconds());
        assertNotNull(request.onlineUser());
        verify(userActionListener).recordLoginSuccess(loginUser);
        verify(authEmailCodeService).validateCode(EmailCodeScene.EMAIL_LOGIN, "a@b.com", "1234");
    }

    @Test
    @DisplayName("login: should keep global token timeout when client timeout is null")
    void loginShouldKeepGlobalTokenTimeoutWhenClientTimeoutNull() {
        EmailAuthStrategy strategy = new EmailAuthStrategy(loginService, userMapper, authEmailCodeService, tokenService, userActionListener);
        SysUserVo user = new SysUserVo();
        user.setEmail("a@b.com");
        user.setUserName("admin");
        user.setStatus(SystemConstants.NORMAL);
        when(userMapper.selectVoOne(any())).thenReturn(user);

        LoginUser loginUser = loginUser();
        when(loginService.buildLoginUser(user)).thenReturn(loginUser);
        when(authEmailCodeService.validateCode(EmailCodeScene.EMAIL_LOGIN, "a@b.com", "1234")).thenReturn(true);
        doAnswer(invocation -> {
            Supplier<?> supplier = invocation.getArgument(2);
            assertEquals(Boolean.FALSE, supplier.get());
            return null;
        }).when(loginService).checkLogin(eq(LoginType.EMAIL), eq("admin"), any());

        SysClientVo client = buildClient();
        client.setTimeout(null);
        client.setActiveTimeout(null);

        when(tokenService.issue(any(SecurityTokenIssueRequest.class)))
            .thenReturn(new SecurityIssuedToken("email-token", 3600L, "digest-1", "jwt-1"));
        when(userActionListener.buildOnlineUser(eq(loginUser), eq("pc"), eq("web"))).thenReturn(new UserOnlineDTO());

        LoginVo result = strategy.login(emailBody("a@b.com", "1234"), client);

        assertEquals("email-token", result.getAccessToken());
        ArgumentCaptor<SecurityTokenIssueRequest> requestCaptor = ArgumentCaptor.forClass(SecurityTokenIssueRequest.class);
        verify(tokenService).issue(requestCaptor.capture());
        SecurityTokenIssueRequest request = requestCaptor.getValue();
        assertSame(loginUser, request.loginUser());
        assertEquals("web", request.deviceType());
        assertNull(request.timeoutSeconds());
        assertNull(request.activeTimeoutSeconds());
        assertNotNull(request.onlineUser());
        verify(userActionListener).recordLoginSuccess(loginUser);
    }

    private SysClientVo buildClient() {
        SysClientVo client = new SysClientVo();
        client.setClientId("pc");
        client.setClientKey("client-key");
        client.setDeviceType("web");
        client.setTimeout(3600L);
        client.setActiveTimeout(1200L);
        return client;
    }

    private LoginUser loginUser() {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(1L);
        loginUser.setUserType("sys_user");
        loginUser.setUsername("admin");
        return loginUser;
    }

    private String emailBody(String email, String emailCode) {
        return "{\"clientId\":\"pc\",\"grantType\":\"email\",\"email\":\"" + email +
            "\",\"emailCode\":\"" + emailCode + "\"}";
    }
}
