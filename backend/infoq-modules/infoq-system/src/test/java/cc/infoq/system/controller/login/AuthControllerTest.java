package cc.infoq.system.controller.login;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.model.ForgotPasswordBody;
import cc.infoq.common.domain.model.RegisterBody;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.service.*;
import cc.infoq.system.support.plugin.OptionalMailHelper;
import cc.infoq.system.support.plugin.OptionalSseHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;

import java.util.List;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class AuthControllerTest {

    private GenericApplicationContext context;

    @Mock
    private SysLoginService sysLoginService;
    @Mock
    private SysRegisterService sysRegisterService;
    @Mock
    private SysConfigService sysConfigService;
    @Mock
    private SysClientService sysClientService;
    @Mock
    private SysForgotPasswordService sysForgotPasswordService;
    @Mock
    private SysInviteCodeService sysInviteCodeService;
    @Mock
    private ScheduledExecutorService scheduledExecutorService;

    @InjectMocks
    private AuthController controller;

    @org.junit.jupiter.api.BeforeEach
    void initSpringContext() {
        context = new GenericApplicationContext();
        context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
        context.registerBean(Validator.class, () -> Validation.buildDefaultValidatorFactory().getValidator());
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
    @DisplayName("register: should fail when register switch is disabled")
    void registerShouldFailWhenDisabled() {
        RegisterBody body = new RegisterBody();
        when(sysConfigService.selectRegisterEnabled()).thenReturn(false);

        ApiResult<Void> result = controller.register(body);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("当前系统没有开启注册功能"));
        verifyNoInteractions(sysRegisterService, sysInviteCodeService);
    }

    @Test
    @DisplayName("register: should validate invite code when invite register is enabled")
    void registerShouldValidateInviteCodeWhenInviteRegisterEnabled() {
        RegisterBody body = new RegisterBody();
        body.setInviteCode("INVITE-CODE");
        when(sysConfigService.selectRegisterEnabled()).thenReturn(true);
        when(sysConfigService.selectInviteRegisterEnabled()).thenReturn(true);

        try (MockedStatic<OptionalMailHelper> mailHelper = mockStatic(OptionalMailHelper.class)) {
            mailHelper.when(OptionalMailHelper::isEnabled).thenReturn(true);

            ApiResult<Void> result = controller.register(body);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            verify(sysInviteCodeService).validateInviteCodeAvailable("INVITE-CODE");
            verify(sysRegisterService).register(body);
        }
    }

    @Test
    @DisplayName("checkInviteCode: should fail when invite register switch is disabled")
    void checkInviteCodeShouldFailWhenInviteRegisterDisabled() {
        when(sysConfigService.selectInviteRegisterEnabled()).thenReturn(false);

        ApiResult<Void> result = controller.checkInviteCode("INVITE-CODE");

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("邀请码不可用"));
        verifyNoInteractions(sysInviteCodeService);
    }

    @Test
    @DisplayName("forgotPassword: should fail when switch is disabled")
    void forgotPasswordShouldFailWhenDisabled() {
        ForgotPasswordBody body = new ForgotPasswordBody();
        when(sysConfigService.selectForgotPasswordEnabled()).thenReturn(false);

        ApiResult<Void> result = controller.forgotPassword(body);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("当前系统没有开启忘记密码功能"));
        verifyNoInteractions(sysForgotPasswordService);
    }

    @Test
    @DisplayName("forgotPassword: should fail when mail feature is disabled")
    void forgotPasswordShouldFailWhenMailDisabled() {
        ForgotPasswordBody body = new ForgotPasswordBody();
        when(sysConfigService.selectForgotPasswordEnabled()).thenReturn(true);

        try (MockedStatic<OptionalMailHelper> mailHelper = mockStatic(OptionalMailHelper.class)) {
            mailHelper.when(OptionalMailHelper::isEnabled).thenReturn(false);

            ApiResult<Void> result = controller.forgotPassword(body);

            assertEquals(ApiResult.FAIL, result.getCode());
            assertTrue(result.getMsg().contains("当前系统没有开启邮箱功能"));
            verifyNoInteractions(sysForgotPasswordService);
        }
    }

    @Test
    @DisplayName("logout: should call service and return success")
    void logoutShouldCallServiceAndReturnSuccess() {
        ApiResult<Void> result = controller.logout();

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysLoginService).logout();
    }

    @Test
    @DisplayName("login: should fail when client is not found")
    void loginShouldFailWhenClientNotFound() {
        when(sysClientService.queryByClientId("pc")).thenReturn(null);

        ApiResult<LoginVo> result = controller.login("{\"clientId\":\"pc\",\"grantType\":\"password\"}");

        assertEquals(ApiResult.FAIL, result.getCode());
        verifyNoInteractions(scheduledExecutorService);
    }

    @Test
    @DisplayName("login: should fail when client status is disabled")
    void loginShouldFailWhenClientDisabled() {
        SysClientVo client = new SysClientVo();
        client.setClientId("pc");
        client.setGrantType("password,email");
        client.setStatus(SystemConstants.DISABLE);
        when(sysClientService.queryByClientId("pc")).thenReturn(client);

        ApiResult<LoginVo> result = controller.login("{\"clientId\":\"pc\",\"grantType\":\"password\"}");

        assertEquals(ApiResult.FAIL, result.getCode());
        verifyNoInteractions(scheduledExecutorService);
    }

    @Test
    @DisplayName("login: should fail when grant type only matches by substring")
    void loginShouldFailWhenGrantTypeOnlyMatchesBySubstring() {
        SysClientVo client = new SysClientVo();
        client.setClientId("pc");
        client.setGrantType("oauth2");
        client.setStatus(SystemConstants.NORMAL);
        when(sysClientService.queryByClientId("pc")).thenReturn(client);

        ApiResult<LoginVo> result = controller.login("{\"clientId\":\"pc\",\"grantType\":\"oauth\"}");

        assertEquals(ApiResult.FAIL, result.getCode());
        verifyNoInteractions(scheduledExecutorService);
    }

    @Test
    @DisplayName("login: should return success and schedule welcome message when client is valid")
    void loginShouldReturnSuccessAndScheduleMessage() {
        SysClientVo client = new SysClientVo();
        client.setClientId("pc");
        client.setGrantType("password,email");
        client.setStatus(SystemConstants.NORMAL);
        when(sysClientService.queryByClientId("pc")).thenReturn(client);
        doReturn(null).when(scheduledExecutorService).schedule(any(Runnable.class), org.mockito.ArgumentMatchers.eq(5L), org.mockito.ArgumentMatchers.eq(TimeUnit.SECONDS));

        LoginVo loginVo = new LoginVo();
        loginVo.setAccessToken("token-1");
        loginVo.setExpireIn(3600L);
        loginVo.setClientId("pc");
        try (MockedStatic<AuthStrategy> authStrategy = mockStatic(AuthStrategy.class)) {
            authStrategy.when(() -> AuthStrategy.loginForResult(any(String.class), org.mockito.ArgumentMatchers.eq(client), org.mockito.ArgumentMatchers.eq("password")))
                .thenReturn(new AuthStrategy.LoginResult(loginVo, 100L));

            ApiResult<LoginVo> result = controller.login("{\"clientId\":\"pc\",\"grantType\":\"password\",\"rememberMe\":true}");

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertEquals("token-1", result.getData().getAccessToken());
            ArgumentCaptor<Runnable> runnableCaptor = ArgumentCaptor.forClass(Runnable.class);
            verify(scheduledExecutorService).schedule(runnableCaptor.capture(), org.mockito.ArgumentMatchers.eq(5L), org.mockito.ArgumentMatchers.eq(TimeUnit.SECONDS));

            try (MockedStatic<OptionalSseHelper> optionalSseHelper = mockStatic(OptionalSseHelper.class)) {
                runnableCaptor.getValue().run();
                optionalSseHelper.verify(() -> OptionalSseHelper.publishToUsers(org.mockito.ArgumentMatchers.eq(List.of(100L)), any(String.class)));
            }
        }
    }
}
