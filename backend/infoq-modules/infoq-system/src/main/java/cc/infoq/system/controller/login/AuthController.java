package cc.infoq.system.controller.login;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.model.ForgotPasswordBody;
import cc.infoq.common.domain.model.LoginBody;
import cc.infoq.common.domain.model.RegisterBody;
import cc.infoq.common.encrypt.annotation.ApiEncrypt;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.utils.DateUtils;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.ValidatorUtils;
import cc.infoq.system.config.WechatMiniAppProperties;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.service.*;
import cc.infoq.system.support.AuthGrantUtils;
import cc.infoq.system.support.plugin.OptionalMailHelper;
import cc.infoq.system.support.plugin.OptionalSseHelper;
import cn.hutool.core.lang.Dict;
import cn.hutool.core.util.ObjectUtil;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 认证接口
 *
 * @author Pontus
 */
@Slf4j
@AllArgsConstructor
@Validated
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final SysLoginService sysLoginService;
    private final SysRegisterService sysRegisterService;
    private final SysConfigService sysConfigService;
    private final SysClientService sysClientService;
    private final SysForgotPasswordService sysForgotPasswordService;
    private final ScheduledExecutorService scheduledExecutorService;
    private final SysInviteCodeService sysInviteCodeService;
    private final WechatMiniAppProperties wechatMiniAppProperties;

    @GetMapping("/wechat-miniapp/enabled")
    public ApiResult<Boolean> wechatMiniAppEnabled() {
        return ApiResult.ok(wechatMiniAppProperties.isEnabled());
    }

    @ApiEncrypt
    @PostMapping("/login")
    public ApiResult<LoginVo> login(@RequestBody String body) {
        Dict loginPayload = JsonUtils.parseMap(body);
        if (ObjectUtil.isNull(loginPayload)) {
            throw new ServiceException("Login payload must be a JSON object");
        }
        LoginBody loginBody = new LoginBody();
        loginBody.setClientId(loginPayload.getStr("clientId"));
        loginBody.setGrantType(loginPayload.getStr("grantType"));
        ValidatorUtils.validate(loginBody);
        String clientId = loginBody.getClientId();
        String grantType = loginBody.getGrantType();
        SysClientVo client = sysClientService.queryByClientId(clientId);
        if (ObjectUtil.isNull(client) || !AuthGrantUtils.supportsGrantType(client, grantType)) {
            log.info("Client id: {} grant type: {} is invalid.", clientId, grantType);
            return ApiResult.fail(MessageUtils.message("auth.grant.type.error"));
        } else if (!SystemConstants.NORMAL.equals(client.getStatus())) {
            return ApiResult.fail(MessageUtils.message("auth.grant.type.blocked"));
        }
        AuthStrategy.LoginResult loginResult = AuthStrategy.loginForResult(body, client, grantType);
        LoginVo loginVo = loginResult.loginVo();

        Long userId = loginResult.userId();
        if (ObjectUtil.isNull(userId)) {
            throw new ServiceException("Login user id is required");
        }
        scheduledExecutorService.schedule(() -> {
            String message = DateUtils.getTodayHour(new Date()) + "好，欢迎登录 infoq-scaffold-backend 后台管理系统";
            OptionalSseHelper.publishToUsers(List.of(userId), message);
        }, 5, TimeUnit.SECONDS);
        return ApiResult.ok(loginVo);
    }

    @PostMapping("/logout")
    public ApiResult<Void> logout() {
        sysLoginService.logout();
        return ApiResult.ok("Logout success");
    }

    @ApiEncrypt
    @PostMapping("/register")
    public ApiResult<Void> register(@Validated @RequestBody RegisterBody user) {
        if (!sysConfigService.selectRegisterEnabled()) {
            return ApiResult.fail("当前系统没有开启注册功能！");
        }
        if (sysConfigService.selectInviteRegisterEnabled()) {
            if (!OptionalMailHelper.isEnabled()) {
                return ApiResult.fail("当前系统没有开启可用于注册的验证码功能！");
            }
            sysInviteCodeService.validateInviteCodeAvailable(user.getInviteCode());
        }
        sysRegisterService.register(user);
        return ApiResult.ok();
    }

    @GetMapping("/invite/code/check")
    public ApiResult<Void> checkInviteCode(@NotBlank(message = "邀请码不能为空") String inviteCode) {
        if (!sysConfigService.selectInviteRegisterEnabled()) {
            return ApiResult.fail("邀请码不可用");
        }
        sysInviteCodeService.validateInviteCodeAvailable(inviteCode);
        return ApiResult.ok();
    }

    @ApiEncrypt
    @PostMapping("/forgot-password")
    public ApiResult<Void> forgotPassword(@Validated @RequestBody ForgotPasswordBody body) {
        if (!sysConfigService.selectForgotPasswordEnabled()) {
            return ApiResult.fail("当前系统没有开启忘记密码功能！");
        }
        if (!OptionalMailHelper.isEnabled()) {
            return ApiResult.fail("当前系统没有开启邮箱功能！");
        }
        sysForgotPasswordService.resetPassword(body);
        return ApiResult.ok();
    }
}
