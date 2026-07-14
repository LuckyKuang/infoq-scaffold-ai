package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.encrypt.annotation.ApiEncrypt;
import cc.infoq.common.log.annotation.Log;
import cc.infoq.common.log.enums.BusinessType;
import cc.infoq.common.oauth.domain.OAuthAuthorizationResult;
import cc.infoq.common.oauth.support.OAuthBrowserBinding;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.system.domain.bo.SysOauthIdentityUnbindBo;
import cc.infoq.system.domain.vo.ProfileOauthIdentityVo;
import cc.infoq.system.service.SysOauthIdentityService;
import cc.infoq.system.service.SysOauthLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 当前用户 OAuth 身份关系接口。
 */
@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/system/user/profile/oauth")
public class SysOauthIdentityController {

    private final SysOauthIdentityService identityService;
    private final SysOauthLoginService oauthLoginService;

    @GetMapping("/identities")
    public ApiResult<List<ProfileOauthIdentityVo>> identities() {
        return ApiResult.ok(identityService.listByCurrentUser(LoginUserContext.getUserId()));
    }

    @GetMapping("/{provider}/bind/authorize")
    public ApiResult<String> authorizeBind(@PathVariable @NotBlank String provider,
                                           @RequestParam(value = "redirect", required = false) String redirect,
                                           HttpServletRequest request) {
        OAuthAuthorizationResult result = oauthLoginService.createBindAuthorization(LoginUserContext.getUserId(), provider, redirect,
            OAuthBrowserBinding.resolve(request));
        return ApiResult.ok(result.getAuthorizationUri().toString());
    }

    @ApiEncrypt
    @Log(title = "OAuth 身份解绑", businessType = BusinessType.DELETE)
    @PostMapping("/identities/{identityId}/unbind")
    public ApiResult<Void> unbind(@PathVariable Long identityId, @RequestBody(required = false) SysOauthIdentityUnbindBo bo) {
        identityService.unbindIdentity(LoginUserContext.getUserId(), identityId, bo);
        return ApiResult.ok();
    }
}
