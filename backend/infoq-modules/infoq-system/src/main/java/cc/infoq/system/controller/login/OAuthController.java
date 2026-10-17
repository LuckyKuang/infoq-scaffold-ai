package cc.infoq.system.controller.login;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.model.LoginBody;
import cc.infoq.common.encrypt.annotation.ApiEncrypt;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.json.utils.JsonUtils;
import cc.infoq.common.oauth.domain.OAuthAuthorizationResult;
import cc.infoq.common.oauth.domain.OAuthCallbackRequest;
import cc.infoq.common.oauth.support.OAuthBrowserBinding;
import cc.infoq.common.utils.DateUtils;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.ValidatorUtils;
import cc.infoq.system.domain.vo.LoginVo;
import cc.infoq.system.domain.vo.OAuthProviderOptionVo;
import cc.infoq.system.domain.vo.SysClientVo;
import cc.infoq.system.service.AuthStrategy;
import cc.infoq.system.service.SysClientService;
import cc.infoq.system.service.SysOauthLoginService;
import cc.infoq.system.service.SysOauthProviderService;
import cc.infoq.system.support.AuthGrantUtils;
import cc.infoq.system.support.plugin.OptionalSseHelper;
import cn.hutool.core.lang.Dict;
import cn.hutool.core.util.ObjectUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Slf4j
@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/auth/oauth")
public class OAuthController {

    private final SysOauthProviderService providerService;
    private final SysOauthLoginService oauthLoginService;
    private final SysClientService sysClientService;
    private final ScheduledExecutorService scheduledExecutorService;

    @GetMapping("/providers")
    public ApiResult<List<OAuthProviderOptionVo>> providers() {
        return ApiResult.ok(providerService.listLoginProviders());
    }

    @GetMapping("/{provider}/authorize")
    public RedirectView authorize(@PathVariable("provider") @NotBlank String provider,
                                  @RequestParam("clientId") String clientId,
                                  @RequestParam(value = "redirect", required = false) String redirect,
                                  HttpServletRequest request) {
        SysClientVo client = requireOAuthClient(clientId);
        OAuthAuthorizationResult result = oauthLoginService.createAuthorization(provider, client.getClientId(), redirect,
            OAuthBrowserBinding.resolve(request));
        return new RedirectView(result.getAuthorizationUri().toString(), false);
    }

    @GetMapping("/{provider}/callback")
    public RedirectView callback(@PathVariable("provider") @NotBlank String provider,
                                 @RequestParam Map<String, String> params,
                                 HttpServletRequest request) {
        OAuthCallbackRequest callbackRequest = new OAuthCallbackRequest();
        callbackRequest.setCode(params.get("code"));
        callbackRequest.setState(params.get("state"));
        callbackRequest.setError(params.get("error"));
        callbackRequest.setErrorDescription(params.get("error_description"));
        try {
            return new RedirectView(oauthLoginService.handleCallback(provider, callbackRequest, OAuthBrowserBinding.resolve(request)), false);
        } catch (ServiceException e) {
            log.info("OAuth callback failed, provider:{}, message:{}", provider, e.getMessage());
            return new RedirectView(oauthLoginService.buildErrorRedirect(e.getMessage()), false);
        } catch (RuntimeException e) {
            log.warn("OAuth callback failed unexpectedly, provider:{}", provider, e);
            return new RedirectView(oauthLoginService.buildErrorRedirect(MessageUtils.message("auth.oauth.callback.failed")), false);
        }
    }

    @ApiEncrypt
    @PostMapping("/ticket")
    public ApiResult<LoginVo> ticket(@RequestBody String body) {
        Dict loginPayload = JsonUtils.parseMap(body);
        if (ObjectUtil.isNull(loginPayload)) {
            throw new ServiceException(MessageUtils.message("auth.oauth.ticket.invalid"));
        }
        LoginBody loginBody = new LoginBody();
        loginBody.setClientId(loginPayload.getStr("clientId"));
        loginBody.setGrantType(loginPayload.getStr("grantType"));
        ValidatorUtils.validate(loginBody);
        if (!SystemConstants.GRANT_TYPE_OAUTH.equals(loginBody.getGrantType())) {
            return ApiResult.fail(MessageUtils.message("auth.grant.type.error"));
        }
        SysClientVo client = requireOAuthClient(loginBody.getClientId());
        AuthStrategy.LoginResult loginResult = AuthStrategy.loginForResult(body, client, SystemConstants.GRANT_TYPE_OAUTH);
        scheduleWelcome(loginResult.userId());
        return ApiResult.ok(loginResult.loginVo());
    }

    private SysClientVo requireOAuthClient(String clientId) {
        SysClientVo client = sysClientService.queryByClientId(clientId);
        if (ObjectUtil.isNull(client) || !AuthGrantUtils.supportsGrantType(client, SystemConstants.GRANT_TYPE_OAUTH)) {
            log.info("Client id: {} grant type: {} is invalid.", clientId, SystemConstants.GRANT_TYPE_OAUTH);
            throw new ServiceException(MessageUtils.message("auth.grant.type.error"));
        } else if (!SystemConstants.NORMAL.equals(client.getStatus())) {
            throw new ServiceException(MessageUtils.message("auth.grant.type.blocked"));
        }
        return client;
    }

    private void scheduleWelcome(Long userId) {
        if (ObjectUtil.isNull(userId)) {
            throw new ServiceException("Login user id is required");
        }
        scheduledExecutorService.schedule(() -> {
            String message = DateUtils.getTodayHour(new Date()) + "好，欢迎登录 infoq-scaffold-backend 后台管理系统";
            OptionalSseHelper.publishToUsers(List.of(userId), message);
        }, 5, TimeUnit.SECONDS);
    }
}
