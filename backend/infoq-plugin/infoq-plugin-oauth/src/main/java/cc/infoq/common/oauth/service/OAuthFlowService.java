package cc.infoq.common.oauth.service;

import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.oauth.adapter.OAuthProviderAdapter;
import cc.infoq.common.oauth.adapter.OAuthProviderRegistry;
import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.*;
import cc.infoq.common.oauth.support.OAuthPkceUtils;
import cc.infoq.common.oauth.support.OAuthRedirectValidator;
import cc.infoq.common.utils.MessageUtils;
import cc.infoq.common.utils.StringUtils;

public class OAuthFlowService {

    private final OAuthProperties properties;
    private final OAuthProviderRegistry providerRegistry;
    private final OAuthRedisStateStore stateStore;

    public OAuthFlowService(OAuthProperties properties,
                            OAuthProviderRegistry providerRegistry,
                            OAuthRedisStateStore stateStore) {
        this.properties = properties;
        this.providerRegistry = providerRegistry;
        this.stateStore = stateStore;
    }

    public boolean isEnabled() {
        return properties.isEnabled();
    }

    public boolean isProviderConfigured(String providerCode) {
        OAuthProperties.Provider provider = properties.getProviders().get(providerCode);
        return providerRegistry.requireAdapter(providerCode).isConfigured(provider);
    }

    public OAuthAuthorizationResult createAuthorization(String providerCode, String clientId, String redirect, String browserBinding) {
        requireEnabled();
        OAuthProperties.Provider provider = requireProvider(providerCode);
        OAuthProviderAdapter adapter = providerRegistry.requireAdapter(providerCode);
        if (!adapter.isConfigured(provider)) {
            throw new ServiceException(MessageUtils.message("auth.oauth.provider.not.configured"));
        }

        OAuthPendingSession pendingSession = new OAuthPendingSession();
        pendingSession.setProviderCode(providerCode);
        pendingSession.setClientId(clientId);
        pendingSession.setRedirect(OAuthRedirectValidator.requireSafeRelativeRedirect(redirect));
        pendingSession.setState(OAuthPkceUtils.secureToken());
        pendingSession.setNonce(OAuthPkceUtils.secureToken());
        pendingSession.setBrowserBinding(browserBinding);
        pendingSession.setCreatedAt(System.currentTimeMillis());
        if (provider.isPkceEnabled()) {
            pendingSession.setCodeVerifier(OAuthPkceUtils.secureToken());
            pendingSession.setCodeChallenge(OAuthPkceUtils.codeChallenge(pendingSession.getCodeVerifier()));
        }
        stateStore.save(pendingSession);

        OAuthAuthorizationResult result = new OAuthAuthorizationResult();
        result.setProviderCode(providerCode);
        result.setState(pendingSession.getState());
        result.setAuthorizationUri(adapter.buildAuthorizationUri(provider, pendingSession));
        return result;
    }

    public OAuthCallbackResult handleCallback(String providerCode, OAuthCallbackRequest callbackRequest, String browserBinding) {
        requireEnabled();
        if (callbackRequest == null) {
            throw new ServiceException(MessageUtils.message("auth.oauth.callback.invalid"));
        }
        if (StringUtils.isNotBlank(callbackRequest.getError())) {
            throw new ServiceException(MessageUtils.message("auth.oauth.denied"));
        }
        OAuthPendingSession pendingSession = stateStore.consume(providerCode, callbackRequest.getState());
        if (!StringUtils.equals(providerCode, pendingSession.getProviderCode())
            || !StringUtils.equals(browserBinding, pendingSession.getBrowserBinding())) {
            throw new ServiceException(MessageUtils.message("auth.oauth.state.invalid"));
        }
        if (StringUtils.isBlank(callbackRequest.getCode())) {
            throw new ServiceException(MessageUtils.message("auth.oauth.callback.invalid"));
        }
        OAuthProperties.Provider provider = requireProvider(providerCode);
        OAuthIdentityProfile profile = providerRegistry.requireAdapter(providerCode)
            .fetchProfile(provider, pendingSession, callbackRequest.getCode());

        OAuthCallbackResult result = new OAuthCallbackResult();
        result.setClientId(pendingSession.getClientId());
        result.setRedirect(pendingSession.getRedirect());
        result.setBrowserBinding(pendingSession.getBrowserBinding());
        result.setProfile(profile);
        return result;
    }

    public OAuthProperties getProperties() {
        return properties;
    }

    private OAuthProperties.Provider requireProvider(String providerCode) {
        OAuthProperties.Provider provider = properties.getProviders().get(providerCode);
        if (provider == null) {
            throw new ServiceException(MessageUtils.message("auth.oauth.provider.not.configured"));
        }
        return provider;
    }

    private void requireEnabled() {
        if (!properties.isEnabled()) {
            throw new ServiceException(MessageUtils.message("auth.oauth.disabled"));
        }
    }
}
