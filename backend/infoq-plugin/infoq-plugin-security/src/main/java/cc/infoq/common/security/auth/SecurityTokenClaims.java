package cc.infoq.common.security.auth;

import cc.infoq.common.utils.StringUtils;

import java.io.Serial;
import java.io.Serializable;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public record SecurityTokenClaims(
    String jwtId,
    String loginId,
    Long userId,
    String userType,
    String clientId,
    String deviceType,
    Instant issuedAt,
    Instant expiresAt,
    Instant activeExpiresAt
) implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    public SecurityTokenClaims {
        if (StringUtils.isBlank(jwtId)) {
            throw new SecurityAuthenticationException("JWT id is required");
        }
        if (StringUtils.isBlank(loginId)) {
            throw new SecurityAuthenticationException("loginId is required");
        }
        if (userId == null) {
            throw new SecurityAuthenticationException("userId is required");
        }
        if (StringUtils.isBlank(userType)) {
            throw new SecurityAuthenticationException("userType is required");
        }
        if (StringUtils.isBlank(clientId)) {
            throw new SecurityAuthenticationException("clientId is required");
        }
        if (issuedAt == null) {
            throw new SecurityAuthenticationException("issuedAt is required");
        }
        if (expiresAt == null) {
            throw new SecurityAuthenticationException("expiresAt is required");
        }
    }

    public Map<String, Object> toJwtPayload(String issuer) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("iss", issuer);
        payload.put(SecurityAuthNames.CLAIM_SUBJECT, loginId);
        payload.put(SecurityAuthNames.CLAIM_USER_ID, userId);
        payload.put(SecurityAuthNames.CLAIM_USER_TYPE, userType);
        payload.put(SecurityAuthNames.CLAIM_CLIENT_ID, clientId);
        payload.put(SecurityAuthNames.CLAIM_DEVICE_TYPE, deviceType);
        payload.put(SecurityAuthNames.CLAIM_JWT_ID, jwtId);
        payload.put(SecurityAuthNames.CLAIM_ISSUED_AT, issuedAt.getEpochSecond());
        payload.put(SecurityAuthNames.CLAIM_EXPIRES_AT, expiresAt.getEpochSecond());
        if (activeExpiresAt != null) {
            payload.put(SecurityAuthNames.CLAIM_ACTIVE_EXPIRES_AT, activeExpiresAt.getEpochSecond());
        }
        return payload;
    }

    public static SecurityTokenClaims fromJwtPayload(Map<String, Object> payload) {
        return new SecurityTokenClaims(
            asString(payload.get(SecurityAuthNames.CLAIM_JWT_ID)),
            asString(payload.get(SecurityAuthNames.CLAIM_SUBJECT)),
            asLong(payload.get(SecurityAuthNames.CLAIM_USER_ID)),
            asString(payload.get(SecurityAuthNames.CLAIM_USER_TYPE)),
            asString(payload.get(SecurityAuthNames.CLAIM_CLIENT_ID)),
            asString(payload.get(SecurityAuthNames.CLAIM_DEVICE_TYPE)),
            toInstant(payload.get(SecurityAuthNames.CLAIM_ISSUED_AT)),
            toInstant(payload.get(SecurityAuthNames.CLAIM_EXPIRES_AT)),
            toInstant(payload.get(SecurityAuthNames.CLAIM_ACTIVE_EXPIRES_AT))
        );
    }

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }

    private static Long asLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.valueOf(value.toString());
    }

    private static Instant toInstant(Object value) {
        Long epochSeconds = asLong(value);
        return epochSeconds == null ? null : Instant.ofEpochSecond(epochSeconds);
    }

}
