package cc.infoq.common.oauth.adapter;

import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.domain.OAuthIdentityProfile;
import cc.infoq.common.oauth.domain.OAuthPendingSession;
import cc.infoq.common.utils.StringUtils;

import java.util.Map;

public class LinuxDoOAuthProviderAdapter extends AbstractOAuthProviderAdapter {

    public static final String PROVIDER_CODE = "linuxdo";

    @Override
    public String providerCode() {
        return PROVIDER_CODE;
    }

    @Override
    public OAuthIdentityProfile fetchProfile(OAuthProperties.Provider provider, OAuthPendingSession pendingSession, String code) {
        Map<String, Object> token = exchangeToken(provider, pendingSession, code);
        Map<String, Object> userInfo = fetchUserInfo(provider, str(token, "access_token"));
        String subject = str(userInfo, "id");
        String email = str(userInfo, "email");
        if (StringUtils.isBlank(email) && StringUtils.isNotBlank(subject)) {
            email = "linuxdo-" + subject + "@linuxdo-connect.invalid";
        }

        OAuthIdentityProfile profile = new OAuthIdentityProfile();
        profile.setProviderCode(PROVIDER_CODE);
        profile.setProviderKey(PROVIDER_CODE);
        profile.setSubject(subject);
        profile.setOpenId(subject);
        profile.setUsername(StringUtils.blankToDefault(str(userInfo, "username"), str(userInfo, "login")));
        profile.setNickname(StringUtils.blankToDefault(str(userInfo, "name"), profile.getUsername()));
        profile.setEmail(email);
        profile.setEmailVerified(Boolean.FALSE);
        profile.setAvatar(StringUtils.blankToDefault(str(userInfo, "avatar_url"), str(userInfo, "avatar")));
        profile.setRawAttributes(userInfo);
        requireSubject(profile);
        return profile;
    }

    @Override
    protected String defaultAuthorizeUri() {
        return "https://connect.linux.do/oauth2/authorize";
    }

    @Override
    protected String defaultTokenUri() {
        return "https://connect.linux.do/oauth2/token";
    }

    @Override
    protected String defaultUserInfoUri() {
        return "https://connect.linux.do/api/user";
    }
}
