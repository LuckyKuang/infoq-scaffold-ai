package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.enums.LoginType;
import cc.infoq.common.exception.user.UserException;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.security.auth.SecurityIssuedToken;
import cc.infoq.common.security.auth.SecurityTokenIssueRequest;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.web.config.properties.CaptchaProperties;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.listener.UserActionListener;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.SysLoginService;
import cn.hutool.crypto.digest.BCrypt;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class PasswordAuthStrategyTest {

    private GenericApplicationContext context;

    @Mock
    private CaptchaProperties captchaProperties;
    @Mock
    private SysLoginService loginService;
    @Mock
    private SysUserMapper userMapper;
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
    @DisplayName("loadUserByUsername: should throw when user does not exist")
    void loadUserByUsernameShouldThrowWhenUserNotExists() throws Exception {
        PasswordAuthStrategy strategy = new PasswordAuthStrategy(captchaProperties, loginService, userMapper, tokenService, userActionListener);
        when(userMapper.selectVoOne(any())).thenReturn(null);

        Method method = PasswordAuthStrategy.class.getDeclaredMethod("loadUserByUsername", String.class);
        method.setAccessible(true);
        InvocationTargetException ex = assertThrows(InvocationTargetException.class, () -> method.invoke(strategy, "admin"));

        assertTrue(ex.getCause() instanceof UserException);
    }

    @Test
    @DisplayName("loadUserByUsername: should throw when user is disabled")
    void loadUserByUsernameShouldThrowWhenUserDisabled() throws Exception {
        PasswordAuthStrategy strategy = new PasswordAuthStrategy(captchaProperties, loginService, userMapper, tokenService, userActionListener);
        SysUserVo user = new SysUserVo();
        user.setUserName("admin");
        user.setStatus(SystemConstants.DISABLE);
        when(userMapper.selectVoOne(any())).thenReturn(user);

        Method method = PasswordAuthStrategy.class.getDeclaredMethod("loadUserByUsername", String.class);
        method.setAccessible(true);
        InvocationTargetException ex = assertThrows(InvocationTargetException.class, () -> method.invoke(strategy, "admin"));

        assertTrue(ex.getCause() instanceof UserException);
    }

    @Test
    @DisplayName("login: should throw when public login cannot find user")
    void loginShouldThrowWhenPublicLoginCannotFindUser() {
        PasswordAuthStrategy strategy = new PasswordAuthStrategy(captchaProperties, loginService, userMapper, tokenService, userActionListener);
        when(captchaProperties.getEnable()).thenReturn(false);
        when(userMapper.selectVoOne(any())).thenReturn(null);

        assertThrows(UserException.class, () -> strategy.login(passwordBody("admin", "123456", null, null, false), buildClient()));
    }

    @Test
    @DisplayName("login: should return token when captcha and credential are valid")
    void loginShouldReturnTokenWhenCredentialAndCaptchaValid() {
        PasswordAuthStrategy strategy = new PasswordAuthStrategy(captchaProperties, loginService, userMapper, tokenService, userActionListener);
        when(captchaProperties.getEnable()).thenReturn(true);

        SysUserVo user = new SysUserVo();
        user.setUserName("admin");
        user.setPassword(BCrypt.hashpw("123456"));
        user.setStatus(SystemConstants.NORMAL);
        when(userMapper.selectVoOne(any())).thenReturn(user);

        LoginUser loginUser = loginUser();
        when(loginService.buildLoginUser(user)).thenReturn(loginUser);
        doAnswer(invocation -> {
            Supplier<?> supplier = invocation.getArgument(2);
            assertEquals(Boolean.FALSE, supplier.get());
            return null;
        }).when(loginService).checkLogin(eq(LoginType.PASSWORD), eq("admin"), any());

        when(tokenService.issue(any(SecurityTokenIssueRequest.class)))
            .thenReturn(new SecurityIssuedToken("token-123", 7200L, "digest-1", "jwt-1"));
        when(userActionListener.buildOnlineUser(eq(loginUser), eq("pc"), eq("web"))).thenReturn(new UserOnlineDTO());

        try (MockedStatic<RedisUtils> redisUtils = mockStatic(RedisUtils.class)) {
            redisUtils.when(() -> RedisUtils.getCacheObject(anyString())).thenReturn("AbCd");

            LoginVo result = strategy.login(passwordBody("admin", "123456", "abCD", "u-1", true), buildClient());

            assertEquals("token-123", result.getAccessToken());
            assertEquals(7200L, result.getExpireIn());
            assertEquals("pc", result.getClientId());
            assertEquals("client-key", loginUser.getClientKey());
            assertEquals("web", loginUser.getDeviceType());
            ArgumentCaptor<SecurityTokenIssueRequest> requestCaptor = ArgumentCaptor.forClass(SecurityTokenIssueRequest.class);
            verify(tokenService).issue(requestCaptor.capture());
            SecurityTokenIssueRequest request = requestCaptor.getValue();
            assertSame(loginUser, request.loginUser());
            assertEquals("pc", request.clientId());
            assertEquals("web", request.deviceType());
            assertEquals(7200L, request.timeoutSeconds());
            assertEquals(1800L, request.activeTimeoutSeconds());
            assertNotNull(request.onlineUser());
            verify(userActionListener).recordLoginSuccess(loginUser);
            redisUtils.verify(() -> RedisUtils.deleteObject(anyString()));
        }
    }

    @Test
    @DisplayName("login: should keep strict parsing for unknown fields")
    void loginShouldRejectUnknownFields() {
        PasswordAuthStrategy strategy = new PasswordAuthStrategy(captchaProperties, loginService, userMapper, tokenService, userActionListener);

        RuntimeException exception = assertThrows(RuntimeException.class,
            () -> strategy.login(passwordBodyWithExtraField("admin", "123456", "extra", "true"), buildClient()));

        assertTrue(exception.getCause() instanceof UnrecognizedPropertyException);
    }

    @Test
    @DisplayName("login: should keep global token timeout when client timeout is null")
    void loginShouldKeepGlobalTokenTimeoutWhenClientTimeoutNull() {
        PasswordAuthStrategy strategy = new PasswordAuthStrategy(captchaProperties, loginService, userMapper, tokenService, userActionListener);
        when(captchaProperties.getEnable()).thenReturn(false);

        SysUserVo user = new SysUserVo();
        user.setUserName("admin");
        user.setPassword(BCrypt.hashpw("123456"));
        user.setStatus(SystemConstants.NORMAL);
        when(userMapper.selectVoOne(any())).thenReturn(user);

        LoginUser loginUser = loginUser();
        when(loginService.buildLoginUser(user)).thenReturn(loginUser);
        doAnswer(invocation -> {
            Supplier<?> supplier = invocation.getArgument(2);
            assertEquals(Boolean.FALSE, supplier.get());
            return null;
        }).when(loginService).checkLogin(eq(LoginType.PASSWORD), eq("admin"), any());

        SysClientVo client = buildClient();
        client.setTimeout(null);
        client.setActiveTimeout(null);

        when(tokenService.issue(any(SecurityTokenIssueRequest.class)))
            .thenReturn(new SecurityIssuedToken("token-123", 7200L, "digest-1", "jwt-1"));
        when(userActionListener.buildOnlineUser(eq(loginUser), eq("pc"), eq("web"))).thenReturn(new UserOnlineDTO());

        LoginVo result = strategy.login(passwordBody("admin", "123456", null, null, false), client);

        assertEquals("token-123", result.getAccessToken());
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

    @Test
    @DisplayName("login: should delegate each successful login to token service")
    void loginShouldDelegateEachSuccessfulLoginToTokenService() {
        PasswordAuthStrategy strategy = new PasswordAuthStrategy(captchaProperties, loginService, userMapper, tokenService, userActionListener);
        when(captchaProperties.getEnable()).thenReturn(false);

        SysUserVo user = new SysUserVo();
        user.setUserName("admin");
        user.setPassword(BCrypt.hashpw("123456"));
        user.setStatus(SystemConstants.NORMAL);
        when(userMapper.selectVoOne(any())).thenReturn(user);
        when(loginService.buildLoginUser(user)).thenReturn(loginUser(), loginUser());
        doAnswer(invocation -> null).when(loginService).checkLogin(eq(LoginType.PASSWORD), eq("admin"), any());
        when(tokenService.issue(any(SecurityTokenIssueRequest.class)))
            .thenReturn(new SecurityIssuedToken("token-first", 7200L, "digest-1", "jwt-1"))
            .thenReturn(new SecurityIssuedToken("token-second", 7200L, "digest-2", "jwt-2"));
        when(userActionListener.buildOnlineUser(any(LoginUser.class), eq("pc"), eq("web"))).thenReturn(new UserOnlineDTO());

        LoginVo first = strategy.login(passwordBody("admin", "123456", null, null, false), buildClient());
        LoginVo second = strategy.login(passwordBody("admin", "123456", null, null, false), buildClient());

        assertEquals("token-first", first.getAccessToken());
        assertEquals("token-second", second.getAccessToken());
        verify(tokenService, times(2)).issue(any(SecurityTokenIssueRequest.class));
        verify(userActionListener, times(2)).recordLoginSuccess(any(LoginUser.class));
    }

    private SysClientVo buildClient() {
        SysClientVo client = new SysClientVo();
        client.setClientId("pc");
        client.setClientKey("client-key");
        client.setDeviceType("web");
        client.setTimeout(7200L);
        client.setActiveTimeout(1800L);
        return client;
    }

    private LoginUser loginUser() {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(1L);
        loginUser.setUserType("sys_user");
        loginUser.setUsername("admin");
        return loginUser;
    }

    private String passwordBody(String username, String password, String code, String uuid, boolean rememberMe) {
        String codePart = code == null ? "" : ",\"code\":\"" + code + "\"";
        String uuidPart = uuid == null ? "" : ",\"uuid\":\"" + uuid + "\"";
        String rememberMePart = rememberMe ? ",\"rememberMe\":true" : "";
        return "{\"clientId\":\"pc\",\"grantType\":\"password\",\"username\":\"" + username +
            "\",\"password\":\"" + password + "\"" + codePart + uuidPart + rememberMePart + "}";
    }

    private String passwordBodyWithExtraField(String username, String password, String fieldName, String fieldValueLiteral) {
        return "{\"clientId\":\"pc\",\"grantType\":\"password\",\"username\":\"" + username +
            "\",\"password\":\"" + password + "\",\"" + fieldName + "\":" + fieldValueLiteral + "}";
    }
}
