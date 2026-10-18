package cc.infoq.common.oauth.adapter;

import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
import cc.infoq.common.oauth.domain.OAuthPendingSession;

import java.net.URI;

public interface OAuthProviderAdapter {

    String providerCode();

    boolean isConfigured(OAuthProperties.Provider provider);

    URI buildAuthorizationUri(OAuthProperties.Provider provider, OAuthPendingSession pendingSession);

    OAuthIdentityProfile fetchProfile(OAuthProperties.Provider provider, OAuthPendingSession pendingSession, String code);
}
