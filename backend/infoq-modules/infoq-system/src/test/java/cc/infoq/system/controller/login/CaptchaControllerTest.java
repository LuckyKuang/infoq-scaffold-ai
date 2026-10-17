package cc.infoq.system.controller.login;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.constant.GlobalConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.model.SendEmailCodeBody;
import cc.infoq.common.enums.EmailCodeScene;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.web.config.properties.CaptchaProperties;
import cc.infoq.common.web.enums.CaptchaCategory;
import cc.infoq.common.web.enums.CaptchaType;
import cc.infoq.system.domain.vo.CaptchaVo;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.AuthEmailCodeService;
import cc.infoq.system.service.SysConfigService;
import cc.infoq.system.service.SysInviteCodeService;
import cc.infoq.system.support.plugin.OptionalMailHelper;
import cn.hutool.captcha.LineCaptcha;
import cn.hutool.core.util.IdUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class CaptchaControllerTest {

    @Mock
    private CaptchaProperties captchaProperties;
    @Mock
    private SysConfigService sysConfigService;
    @Mock
    private AuthEmailCodeService authEmailCodeService;
    @Mock
    private SysUserMapper userMapper;
    @Mock
    private SysInviteCodeService sysInviteCodeService;

    @InjectMocks
    private CaptchaController controller;

    @BeforeEach
    void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> mock(RedissonClient.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("getCode: should return disabled flag and public capabilities when captcha switch is off")
    void getCodeShouldReturnDisabledFlagWhenOff() {
        when(captchaProperties.getEnable()).thenReturn(false);
        when(sysConfigService.selectRegisterEnabled()).thenReturn(true);
        when(sysConfigService.selectInviteRegisterEnabled()).thenReturn(true);
        when(sysConfigService.selectForgotPasswordEnabled()).thenReturn(false);

        try (MockedStatic<OptionalMailHelper> mailHelper = mockStatic(OptionalMailHelper.class)) {
            mailHelper.when(OptionalMailHelper::isEnabled).thenReturn(true);

            ApiResult<CaptchaVo> result = controller.getCode();

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertFalse(result.getData().getCaptchaEnabled());
            assertTrue(result.getData().getRegisterEnabled());
            assertTrue(result.getData().getInviteRegisterEnabled());
            assertFalse(result.getData().getForgotPasswordEnabled());
            assertTrue(result.getData().getMailEnabled());
        }
    }

    @Test
    @DisplayName("getCode: should delegate to AOP proxy when captcha switch is on")
    void getCodeShouldDelegateToAopProxyWhenOn() {
        when(captchaProperties.getEnable()).thenReturn(true);
        when(sysConfigService.selectRegisterEnabled()).thenReturn(false);
        when(sysConfigService.selectInviteRegisterEnabled()).thenReturn(false);
        when(sysConfigService.selectForgotPasswordEnabled()).thenReturn(true);
        CaptchaController proxy = spy(controller);
        CaptchaVo expected = new CaptchaVo();
        expected.setUuid("proxy-uuid");
        org.mockito.Mockito.doReturn(expected).when(proxy).getCodeImpl();

        try (MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class);
             MockedStatic<OptionalMailHelper> mailHelper = mockStatic(OptionalMailHelper.class)) {
            springUtils.when(() -> SpringUtils.getAopProxy(controller)).thenReturn(proxy);
            mailHelper.when(OptionalMailHelper::isEnabled).thenReturn(false);

            ApiResult<CaptchaVo> result = controller.getCode();

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertEquals("proxy-uuid", result.getData().getUuid());
            assertFalse(result.getData().getRegisterEnabled());
            assertFalse(result.getData().getInviteRegisterEnabled());
            assertTrue(result.getData().getForgotPasswordEnabled());
            verify(proxy).getCodeImpl();
        }
    }

    @Test
    @DisplayName("getCodeImpl: should evaluate math captcha result and cache it")
    void getCodeImplShouldEvaluateMathResultAndCacheIt() {
        when(captchaProperties.getType()).thenReturn(CaptchaType.MATH);
        when(captchaProperties.getCategory()).thenReturn(CaptchaCategory.LINE);
        when(captchaProperties.getNumberLength()).thenReturn(2);

        LineCaptcha captcha = Mockito.mock(LineCaptcha.class);
        when(captcha.getCode()).thenReturn("1+2=");
        when(captcha.getImageBase64()).thenReturn("base64-image");

        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> mock(RedissonClient.class));
        context.registerBean(LineCaptcha.class, () -> captcha);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        try (MockedStatic<RedisUtils> redisUtils = mockStatic(RedisUtils.class);
             MockedStatic<IdUtil> idUtil = mockStatic(IdUtil.class)) {
            idUtil.when(IdUtil::simpleUUID).thenReturn("captcha-1");

            CaptchaVo captchaVo = controller.getCodeImpl();

            assertEquals("captcha-1", captchaVo.getUuid());
            assertEquals("base64-image", captchaVo.getImg());
            redisUtils.verify(() -> RedisUtils.setCacheObject(
                GlobalConstants.CAPTCHA_CODE_KEY + "captcha-1",
                "3",
                Duration.ofMinutes(Constants.CAPTCHA_EXPIRATION)
            ));
        }
    }

    @Test
    @DisplayName("emailCode: should return fail when mail feature is disabled")
    void emailCodeShouldReturnFailWhenMailFeatureDisabled() {
        try (MockedStatic<OptionalMailHelper> mailHelper = mockStatic(OptionalMailHelper.class)) {
            mailHelper.when(OptionalMailHelper::isEnabled).thenReturn(false);

            ApiResult<Void> result = controller.emailCode("dev@infoq.cc");

            assertEquals(ApiResult.FAIL, result.getCode());
        }
    }

    @Test
    @DisplayName("emailCode: should delegate to login scene sender when mail feature is enabled")
    void emailCodeShouldDelegateToAopProxyWhenMailEnabled() {
        CaptchaController proxy = spy(controller);
        doNothing().when(proxy).emailCodeImpl("dev@infoq.cc");
        try (MockedStatic<OptionalMailHelper> mailHelper = mockStatic(OptionalMailHelper.class);
             MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            mailHelper.when(OptionalMailHelper::isEnabled).thenReturn(true);
            springUtils.when(() -> SpringUtils.getAopProxy(controller)).thenReturn(proxy);

            ApiResult<Void> result = controller.emailCode("dev@infoq.cc");

            assertEquals(ApiResult.SUCCESS, result.getCode());
            verify(proxy).emailCodeImpl("dev@infoq.cc");
        }
    }

    @Test
    @DisplayName("emailCodeImpl: should delegate to email login scene service")
    void emailCodeImplShouldDelegateToLoginSceneService() {
        controller.emailCodeImpl("dev@infoq.cc");

        verify(authEmailCodeService).sendCode(EmailCodeScene.EMAIL_LOGIN, "dev@infoq.cc");
    }

    @Test
    @DisplayName("sendEmailCode: should return fail when register switch is disabled")
    void sendEmailCodeShouldFailWhenRegisterDisabled() {
        SendEmailCodeBody body = new SendEmailCodeBody();
        body.setEmail("new@infoq.cc");
        body.setScene("register");
        when(sysConfigService.selectRegisterEnabled()).thenReturn(false);

        try (MockedStatic<OptionalMailHelper> mailHelper = mockStatic(OptionalMailHelper.class)) {
            mailHelper.when(OptionalMailHelper::isEnabled).thenReturn(true);

            ApiResult<Void> result = controller.sendEmailCode(body);

            assertEquals(ApiResult.FAIL, result.getCode());
            verifyNoInteractions(authEmailCodeService);
        }
    }

    @Test
    @DisplayName("sendEmailCode: should return success without sending for missing forgot-password account")
    void sendEmailCodeShouldSkipForgotPasswordWhenEmailMissing() {
        SendEmailCodeBody body = new SendEmailCodeBody();
        body.setEmail("missing@infoq.cc");
        body.setScene("forgot_password");
        when(captchaProperties.getEnable()).thenReturn(false);
        when(sysConfigService.selectForgotPasswordEnabled()).thenReturn(true);
        when(userMapper.exists(any())).thenReturn(false);

        try (MockedStatic<OptionalMailHelper> mailHelper = mockStatic(OptionalMailHelper.class)) {
            mailHelper.when(OptionalMailHelper::isEnabled).thenReturn(true);

            ApiResult<Void> result = controller.sendEmailCode(body);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            verifyNoInteractions(authEmailCodeService);
        }
    }

    @Test
    @DisplayName("sendEmailCode: should delegate register scene to AOP proxy when email is available")
    void sendEmailCodeShouldDelegateToProxyForRegisterScene() {
        SendEmailCodeBody body = new SendEmailCodeBody();
        body.setEmail("new@infoq.cc");
        body.setScene("register");
        when(captchaProperties.getEnable()).thenReturn(false);
        when(sysConfigService.selectRegisterEnabled()).thenReturn(true);
        when(sysConfigService.selectInviteRegisterEnabled()).thenReturn(false);
        when(userMapper.exists(any())).thenReturn(false);
        CaptchaController proxy = spy(controller);
        doNothing().when(proxy).sendEmailCodeImpl(EmailCodeScene.REGISTER, "new@infoq.cc");

        try (MockedStatic<OptionalMailHelper> mailHelper = mockStatic(OptionalMailHelper.class);
             MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            mailHelper.when(OptionalMailHelper::isEnabled).thenReturn(true);
            springUtils.when(() -> SpringUtils.getAopProxy(controller)).thenReturn(proxy);

            ApiResult<Void> result = controller.sendEmailCode(body);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            verify(proxy).sendEmailCodeImpl(EmailCodeScene.REGISTER, "new@infoq.cc");
            verifyNoInteractions(sysInviteCodeService);
        }
    }

    @Test
    @DisplayName("sendEmailCode: should validate invite code before sending register email code")
    void sendEmailCodeShouldValidateInviteCodeBeforeRegisterScene() {
        SendEmailCodeBody body = new SendEmailCodeBody();
        body.setEmail("new@infoq.cc");
        body.setScene("register");
        body.setInviteCode("INVITE-CODE");
        when(captchaProperties.getEnable()).thenReturn(false);
        when(sysConfigService.selectRegisterEnabled()).thenReturn(true);
        when(sysConfigService.selectInviteRegisterEnabled()).thenReturn(true);
        when(userMapper.exists(any())).thenReturn(false);
        CaptchaController proxy = spy(controller);
        doNothing().when(proxy).sendEmailCodeImpl(EmailCodeScene.REGISTER, "new@infoq.cc");

        try (MockedStatic<OptionalMailHelper> mailHelper = mockStatic(OptionalMailHelper.class);
             MockedStatic<SpringUtils> springUtils = mockStatic(SpringUtils.class)) {
            mailHelper.when(OptionalMailHelper::isEnabled).thenReturn(true);
            springUtils.when(() -> SpringUtils.getAopProxy(controller)).thenReturn(proxy);

            ApiResult<Void> result = controller.sendEmailCode(body);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            verify(sysInviteCodeService).validateInviteCodeAvailable("INVITE-CODE");
            verify(proxy).sendEmailCodeImpl(EmailCodeScene.REGISTER, "new@infoq.cc");
        }
    }

    @Test
    @DisplayName("sendEmailCodeImpl: should wrap downstream exception as service exception")
    void sendEmailCodeImplShouldWrapDownstreamException() {
        org.mockito.Mockito.doThrow(new RuntimeException("mail send failed"))
            .when(authEmailCodeService).sendCode(EmailCodeScene.REGISTER, "new@infoq.cc");

        ServiceException ex = assertThrows(
            ServiceException.class,
            () -> controller.sendEmailCodeImpl(EmailCodeScene.REGISTER, "new@infoq.cc")
        );

        assertEquals("mail send failed", ex.getMessage());
    }
}
