package cc.infoq.common.security.auth;

import cc.infoq.common.domain.model.LoginUser;

public record SecurityTokenAuthentication(
    String accessToken,
    String tokenDigest,
    SecurityTokenClaims claims,
    SecurityTokenSession session
) {

    public LoginUser loginUser() {
        return session.getLoginUser();
    }

}
