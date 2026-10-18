package cc.infoq.common.oauth.adapter;

import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
import cc.infoq.common.oauth.domain.OAuthPendingSession;
import cc.infoq.common.utils.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

public class GitHubOAuthProviderAdapter extends AbstractOAuthProviderAdapter {

    public static final String PROVIDER_CODE = "github";
    private static final String DEFAULT_EMAILS_URI = "https://api.github.com/user/emails";

    public GitHubOAuthProviderAdapter() {
        super();
    }

    GitHubOAuthProviderAdapter(RestClient restClient) {
        super(restClient);
    }

    @Override
    public String providerCode() {
        return PROVIDER_CODE;
    }

    @Override
    public OAuthIdentityProfile fetchProfile(OAuthProperties.Provider provider, OAuthPendingSession pendingSession, String code) {
        Map<String, Object> token = exchangeToken(provider, pendingSession, code);
        String accessToken = str(token, "access_token");
        Map<String, Object> userInfo = fetchUserInfo(provider, accessToken);
        String email = resolveVerifiedPrimaryEmail(fetchUserInfoList(resolveEmailsUri(provider), accessToken));

        OAuthIdentityProfile profile = new OAuthIdentityProfile();
        profile.setProviderCode(PROVIDER_CODE);
        profile.setProviderKey(PROVIDER_CODE);
        profile.setSubject(str(userInfo, "id"));
        profile.setOpenId(profile.getSubject());
        profile.setUsername(str(userInfo, "login"));
        profile.setNickname(str(userInfo, "name"));
        profile.setEmail(email);
        profile.setEmailVerified(StringUtils.isNotBlank(email));
        profile.setAvatar(str(userInfo, "avatar_url"));
        profile.setRawAttributes(userInfo);
        requireSubject(profile);
        return profile;
    }

    private String resolveVerifiedPrimaryEmail(List<Map<String, Object>> emails) {
        for (Map<String, Object> email : emails) {
            String value = str(email, "email");
            if (StringUtils.isNotBlank(value)
                && Boolean.TRUE.equals(bool(email, "primary"))
                && Boolean.TRUE.equals(bool(email, "verified"))) {
                return value;
            }
        }
        return null;
    }

    private String resolveEmailsUri(OAuthProperties.Provider provider) {
        String userInfoUri = resolveUserInfoUri(provider);
        if (StringUtils.endsWith(userInfoUri, "/user")) {
            return userInfoUri + "/emails";
        }
        return DEFAULT_EMAILS_URI;
    }

    @Override
    protected String defaultAuthorizeUri() {
        return "https://github.com/login/oauth/authorize";
    }

    @Override
    protected String defaultTokenUri() {
        return "https://github.com/login/oauth/access_token";
    }

    @Override
    protected String defaultUserInfoUri() {
        return "https://api.github.com/user";
    }
}
