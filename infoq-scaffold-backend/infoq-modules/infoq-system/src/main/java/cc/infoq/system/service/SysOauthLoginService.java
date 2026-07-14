package cc.infoq.system.service;

import cc.infoq.common.oauth.domain.OAuthAuthorizationResult;
import cc.infoq.common.oauth.domain.OAuthCallbackRequest;

public interface SysOauthLoginService {

    OAuthAuthorizationResult createAuthorization(String providerCode, String clientId, String redirect, String browserBinding);

    /**
     * 创建当前用户的 OAuth 绑定授权。
     */
    OAuthAuthorizationResult createBindAuthorization(Long userId, String providerCode, String redirect, String browserBinding);

    String handleCallback(String providerCode, OAuthCallbackRequest callbackRequest, String browserBinding);

    String buildErrorRedirect(String message);
}
