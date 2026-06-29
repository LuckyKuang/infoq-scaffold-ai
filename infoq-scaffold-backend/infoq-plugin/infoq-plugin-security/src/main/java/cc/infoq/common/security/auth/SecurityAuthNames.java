package cc.infoq.common.security.auth;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/**
 * Spring Security 认证共享名称
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class SecurityAuthNames {

    public static final String AUTHORIZATION = "Authorization";
    public static final String BEARER = "Bearer";
    public static final String CLIENT_ID = "clientid";

    public static final String CLAIM_SUBJECT = "sub";
    public static final String CLAIM_USER_ID = "userId";
    public static final String CLAIM_USER_TYPE = "userType";
    public static final String CLAIM_CLIENT_ID = "clientid";
    public static final String CLAIM_DEVICE_TYPE = "deviceType";
    public static final String CLAIM_JWT_ID = "jti";
    public static final String CLAIM_ISSUED_AT = "iat";
    public static final String CLAIM_EXPIRES_AT = "exp";
    public static final String CLAIM_ACTIVE_EXPIRES_AT = "activeExp";

    public static final String TOKEN_SESSION_KEY_PREFIX = "security:token:session:";
    public static final String TOKEN_REVOKED_KEY_PREFIX = "security:token:revoked:";
    public static final String TOKEN_LOGIN_INDEX_KEY_PREFIX = "security:token:login:";
    public static final String TOKEN_USER_INDEX_KEY_PREFIX = "security:token:user:";
    public static final String TOKEN_ROLE_INDEX_KEY_PREFIX = "security:token:role:";

}
