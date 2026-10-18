package cc.infoq.system.controller.login;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.constant.GlobalConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.model.SendEmailCodeBody;
import cc.infoq.common.encrypt.annotation.ApiEncrypt;
import cc.infoq.common.enums.EmailCodeScene;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.exception.user.CaptchaException;
import cc.infoq.common.exception.user.CaptchaExpireException;
import cc.infoq.common.redis.annotation.RateLimiter;
import cc.infoq.common.redis.enums.LimitType;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.common.utils.StringUtils;
import cc.infoq.common.utils.reflect.ReflectUtils;
import cc.infoq.common.web.config.properties.CaptchaProperties;
import cc.infoq.common.web.enums.CaptchaType;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.vo.CaptchaVo;
import cc.infoq.system.mapper.SysUserMapper;
import cc.infoq.system.service.AuthEmailCodeService;
import cc.infoq.system.service.SysConfigService;
import cc.infoq.system.service.SysInviteCodeService;
import cc.infoq.system.support.plugin.OptionalMailHelper;
import cn.hutool.captcha.AbstractCaptcha;
import cn.hutool.captcha.generator.CodeGenerator;
import cn.hutool.core.util.IdUtil;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * 验证码操作处理
 *
 * @author Pontus
 */
@Slf4j
@Validated
@AllArgsConstructor
@RestController
public class CaptchaController {

    private final CaptchaProperties captchaProperties;
    private final SysConfigService sysConfigService;
    private final AuthEmailCodeService authEmailCodeService;
    private final SysUserMapper userMapper;
    private final SysInviteCodeService sysInviteCodeService;

    /**
     * 兼容旧客户端的邮箱验证码发送接口，默认用于邮件登录场景
     *
     * @param email 邮箱
     */
    @GetMapping("/resource/email/code")
    public ApiResult<Void> emailCode(@NotBlank(message = "{user.email.not.blank}") String email) {
        if (!OptionalMailHelper.isEnabled()) {
            return ApiResult.fail("当前系统没有开启邮箱功能！");
        }
        SpringUtils.getAopProxy(this).emailCodeImpl(email);
        return ApiResult.ok();
    }

    /**
     * 场景化邮箱验证码
     */
    @ApiEncrypt
    @PostMapping("/auth/email/code")
    public ApiResult<Void> sendEmailCode(@Validated @RequestBody SendEmailCodeBody body) {
        if (!OptionalMailHelper.isEnabled()) {
            return ApiResult.fail("当前系统没有开启邮箱功能！");
        }
        EmailCodeScene scene = EmailCodeScene.fromCode(body.getScene());
        if (scene == EmailCodeScene.REGISTER && !sysConfigService.selectRegisterEnabled()) {
            return ApiResult.fail("当前系统没有开启注册功能！");
        }
        if (scene == EmailCodeScene.FORGOT_PASSWORD && !sysConfigService.selectForgotPasswordEnabled()) {
            return ApiResult.fail("当前系统没有开启忘记密码功能！");
        }
        if (scene == EmailCodeScene.REGISTER && sysConfigService.selectInviteRegisterEnabled()) {
            sysInviteCodeService.validateInviteCodeAvailable(body.getInviteCode());
        }
        if (captchaProperties.getEnable()) {
            validateCaptcha(body.getCode(), body.getUuid());
        }
        if (scene == EmailCodeScene.REGISTER && emailExists(body.getEmail())) {
            return ApiResult.fail("该邮箱已被注册！");
        }
        if (scene == EmailCodeScene.FORGOT_PASSWORD && !emailExists(body.getEmail())) {
            return ApiResult.ok();
        }
        SpringUtils.getAopProxy(this).sendEmailCodeImpl(scene, body.getEmail());
        return ApiResult.ok();
    }

    /**
     * 邮箱验证码发送实现
     */
    @RateLimiter(key = "#scene.code + ':' + #email", time = 60, count = 1)
    public void sendEmailCodeImpl(EmailCodeScene scene, String email) {
        try {
            authEmailCodeService.sendCode(scene, email);
        } catch (Exception e) {
            throw new ServiceException(e.getMessage());
        }
    }

    /**
     * 兼容旧客户端的邮件登录验证码发送实现
     */
    @RateLimiter(key = "#email", time = 60, count = 1)
    public void emailCodeImpl(String email) {
        try {
            authEmailCodeService.sendCode(EmailCodeScene.EMAIL_LOGIN, email);
        } catch (Exception e) {
            throw new ServiceException(e.getMessage());
        }
    }

    /**
     * 生成验证码
     */
    @GetMapping("/auth/code")
    public ApiResult<CaptchaVo> getCode() {
        boolean captchaEnabled = captchaProperties.getEnable();
        CaptchaVo captchaVo;
        if (!captchaEnabled) {
            captchaVo = new CaptchaVo();
            captchaVo.setCaptchaEnabled(false);
        } else {
            captchaVo = SpringUtils.getAopProxy(this).getCodeImpl();
        }
        enrichPublicAuthCapabilities(captchaVo);
        return ApiResult.ok(captchaVo);
    }

    /**
     * 生成验证码
     * 独立方法避免验证码关闭之后仍然走限流
     */
    @RateLimiter(time = 60, count = 10, limitType = LimitType.IP)
    public CaptchaVo getCodeImpl() {
        // 保存验证码信息
        String uuid = IdUtil.simpleUUID();
        String verifyKey = GlobalConstants.CAPTCHA_CODE_KEY + uuid;
        // 生成验证码
        CaptchaType captchaType = captchaProperties.getType();
        CodeGenerator codeGenerator;
        if (CaptchaType.MATH == captchaType) {
            codeGenerator = ReflectUtils.newInstance(captchaType.getClazz(), captchaProperties.getNumberLength(), false);
        } else {
            codeGenerator = ReflectUtils.newInstance(captchaType.getClazz(), captchaProperties.getCharLength());
        }
        AbstractCaptcha captcha = SpringUtils.getBean(captchaProperties.getCategory().getClazz());
        captcha.setGenerator(codeGenerator);
        captcha.createCode();
        // 如果是数学验证码，使用SpEL表达式处理验证码结果
        String code = captcha.getCode();
        if (CaptchaType.MATH == captchaType) {
            ExpressionParser parser = new SpelExpressionParser();
            Expression exp = parser.parseExpression(StringUtils.remove(code, "="));
            code = exp.getValue(String.class);
        }
        RedisUtils.setCacheObject(verifyKey, code, Duration.ofMinutes(Constants.CAPTCHA_EXPIRATION));
        CaptchaVo captchaVo = new CaptchaVo();
        captchaVo.setUuid(uuid);
        captchaVo.setImg(captcha.getImageBase64());
        return captchaVo;
    }

    private void enrichPublicAuthCapabilities(CaptchaVo captchaVo) {
        captchaVo.setRegisterEnabled(sysConfigService.selectRegisterEnabled());
        captchaVo.setInviteRegisterEnabled(sysConfigService.selectInviteRegisterEnabled());
        captchaVo.setForgotPasswordEnabled(sysConfigService.selectForgotPasswordEnabled());
        captchaVo.setMailEnabled(OptionalMailHelper.isEnabled());
    }

    private void validateCaptcha(String code, String uuid) {
        String verifyKey = GlobalConstants.CAPTCHA_CODE_KEY + StringUtils.blankToDefault(uuid, "");
        String captcha = RedisUtils.getCacheObject(verifyKey);
        RedisUtils.deleteObject(verifyKey);
        if (captcha == null) {
            throw new CaptchaExpireException();
        }
        if (!StringUtils.equalsIgnoreCase(code, captcha)) {
            throw new CaptchaException();
        }
    }

    private boolean emailExists(String email) {
        return userMapper.exists(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<SysUser>()
            .eq(SysUser::getEmail, email));
    }

}
