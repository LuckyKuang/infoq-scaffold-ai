package cc.infoq.common.security.auth;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.utils.StringUtils;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

public class SecurityTokenService {

    private static final String JWT_ALG = "HS256";
    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final long NO_EXPIRATION_EPOCH_SECONDS = 253402300799L;

    private final SecurityTokenProperties properties;
    private final SecurityTokenStore tokenStore;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public SecurityTokenService(SecurityTokenProperties properties, SecurityTokenStore tokenStore) {
        this(properties, tokenStore, new ObjectMapper(), Clock.systemUTC());
    }

    SecurityTokenService(SecurityTokenProperties properties, SecurityTokenStore tokenStore, ObjectMapper objectMapper, Clock clock) {
        this.properties = properties;
        this.tokenStore = tokenStore;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.properties.requireSigningSecret();
    }

    public SecurityIssuedToken issue(SecurityTokenIssueRequest request) {
        LoginUser loginUser = requireLoginUser(request.loginUser());
        String clientId = requireText(request.clientId(), "clientId is required");
        String deviceType = StringUtils.blankToDefault(request.deviceType(), loginUser.getDeviceType());
        long timeoutSeconds = effectiveTimeoutSeconds(request.timeoutSeconds(), properties.ttlSeconds());
        long activeTimeoutSeconds = effectiveTimeoutSeconds(request.activeTimeoutSeconds(), properties.activeTimeoutSeconds());
        Instant now = clock.instant();
        Instant expiresAt = expiresAt(now, timeoutSeconds);
        Instant activeExpiresAt = activeExpiresAt(now, activeTimeoutSeconds);
        String jwtId = UUID.randomUUID().toString();
        SecurityTokenClaims claims = new SecurityTokenClaims(
            jwtId,
            loginUser.getLoginId(),
            loginUser.getUserId(),
            loginUser.getUserType(),
            clientId,
            deviceType,
            now,
            expiresAt,
            activeExpiresAt
        );
        String accessToken = encode(claims);
        String tokenDigest = digest(accessToken);
        loginUser.setToken(accessToken);
        loginUser.setLoginTime(now.toEpochMilli());
        loginUser.setExpireTime(timeoutSeconds < 0 ? -1L : expiresAt.toEpochMilli());
        loginUser.setClientKey(clientId);
        loginUser.setDeviceType(deviceType);

        SecurityTokenSession session = new SecurityTokenSession();
        session.setJwtId(jwtId);
        session.setAccessToken(accessToken);
        session.setTokenDigest(tokenDigest);
        session.setLoginId(loginUser.getLoginId());
        session.setUserId(loginUser.getUserId());
        session.setUserType(loginUser.getUserType());
        session.setClientId(clientId);
        session.setDeviceType(deviceType);
        session.setLoginTime(now.toEpochMilli());
        session.setLastAccessTime(now.toEpochMilli());
        session.setExpireTime(timeoutSeconds < 0 ? -1L : expiresAt.toEpochMilli());
        session.setActiveExpireTime(activeExpiresAt == null ? -1L : activeExpiresAt.toEpochMilli());
        session.setLoginUser(loginUser);
        session.setOnlineUser(request.onlineUser());
        session.setRoleIds(tokenStore.extractRoleIds(loginUser));

        tokenStore.save(accessToken, session);
        return new SecurityIssuedToken(accessToken, timeoutSeconds, tokenDigest, jwtId);
    }

    public SecurityTokenAuthentication authenticate(String accessToken, String requestClientId) {
        String token = requireText(accessToken, "access token is required");
        String clientId = requireText(requestClientId, "request clientId is required");
        SecurityTokenClaims claims = parse(token);
        String tokenDigest = digest(token);
        Optional<SecurityTokenSession> optionalSession = tokenStore.findByDigest(tokenDigest);
        SecurityTokenSession session = optionalSession.orElseThrow(
            () -> new SecurityAuthenticationException("token session is missing or revoked"));
        validateSessionConsistency(claims, session, tokenDigest);
        if (!StringUtils.equals(clientId, session.getClientId())) {
            throw new SecurityAuthenticationException("request clientId does not match token session");
        }
        long nowMillis = clock.millis();
        if (session.isExpired(nowMillis)) {
            revoke(token);
            throw new SecurityAuthenticationException("token is expired");
        }
        if (session.isActiveExpired(nowMillis)) {
            revoke(token);
            throw new SecurityAuthenticationException("token active timeout is expired");
        }
        if (session.getActiveExpireTime() != null && session.getActiveExpireTime() > 0) {
            Long lastAccessTime = session.getLastAccessTime();
            long activeTimeoutMillis = lastAccessTime == null
                ? 0L
                : Math.max(0L, session.getActiveExpireTime() - lastAccessTime);
            if (activeTimeoutMillis > 0) {
                tokenStore.touch(session, Duration.ofMillis(activeTimeoutMillis));
            }
        }
        return new SecurityTokenAuthentication(token, tokenDigest, claims, session);
    }

    public SecurityTokenClaims parse(String accessToken) {
        String[] parts = requireText(accessToken, "access token is required").split("\\.");
        if (parts.length != 3) {
            throw new SecurityAuthenticationException("JWT format is invalid");
        }
        String signingInput = parts[0] + "." + parts[1];
        String expectedSignature = hmac(signingInput, properties.requireSigningSecret());
        if (!MessageDigest.isEqual(expectedSignature.getBytes(StandardCharsets.US_ASCII), parts[2].getBytes(StandardCharsets.US_ASCII))) {
            throw new SecurityAuthenticationException("JWT signature is invalid");
        }
        Map<String, Object> header = readJson(parts[0]);
        if (!JWT_ALG.equals(header.get("alg"))) {
            throw new SecurityAuthenticationException("JWT algorithm is unsupported");
        }
        SecurityTokenClaims claims = SecurityTokenClaims.fromJwtPayload(readJson(parts[1]));
        Instant now = clock.instant().minus(properties.getAllowedClockSkew());
        if (claims.expiresAt().isBefore(now)) {
            throw new SecurityAuthenticationException("JWT is expired");
        }
        return claims;
    }

    public boolean revoke(String accessToken) {
        String tokenDigest = digest(accessToken);
        return tokenStore.revoke(accessToken, tokenDigest);
    }

    public int revokeByLoginId(String loginId) {
        return tokenStore.revokeByLoginId(loginId);
    }

    public int revokeByUserId(Long userId) {
        return tokenStore.revokeByUserId(userId);
    }

    public int revokeByRoleId(Long roleId) {
        return tokenStore.revokeByRoleId(roleId);
    }

    public String digest(String accessToken) {
        String token = requireText(accessToken, "access token is required");
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = messageDigest.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    public String shortDigest(String accessToken) {
        String tokenDigest = digest(accessToken);
        return tokenDigest.substring(0, Math.min(12, tokenDigest.length()));
    }

    private String encode(SecurityTokenClaims claims) {
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", JWT_ALG);
        header.put("typ", "JWT");
        String encodedHeader = base64Url(writeJson(header));
        String encodedPayload = base64Url(writeJson(claims.toJwtPayload(properties.getIssuer())));
        String signingInput = encodedHeader + "." + encodedPayload;
        return signingInput + "." + hmac(signingInput, properties.requireSigningSecret());
    }

    private void validateSessionConsistency(SecurityTokenClaims claims, SecurityTokenSession session, String tokenDigest) {
        if (!StringUtils.equals(tokenDigest, session.getTokenDigest())) {
            throw new SecurityAuthenticationException("token digest does not match session");
        }
        if (!StringUtils.equals(claims.jwtId(), session.getJwtId())) {
            throw new SecurityAuthenticationException("JWT id does not match session");
        }
        if (!StringUtils.equals(claims.loginId(), session.getLoginId())
            || !StringUtils.equals(claims.userType(), session.getUserType())
            || !claims.userId().equals(session.getUserId())) {
            throw new SecurityAuthenticationException("token identity does not match session");
        }
        if (!StringUtils.equals(claims.clientId(), session.getClientId())) {
            throw new SecurityAuthenticationException("token clientId does not match session");
        }
    }

    private LoginUser requireLoginUser(LoginUser loginUser) {
        if (loginUser == null) {
            throw new SecurityAuthenticationException("loginUser is required");
        }
        loginUser.getLoginId();
        return loginUser;
    }

    private String requireText(String value, String message) {
        if (StringUtils.isBlank(value)) {
            throw new SecurityAuthenticationException(message);
        }
        return value.trim();
    }

    private long effectiveTimeoutSeconds(Long candidate, long fallback) {
        return candidate == null ? fallback : candidate;
    }

    private Instant expiresAt(Instant now, long timeoutSeconds) {
        if (timeoutSeconds < 0) {
            return Instant.ofEpochSecond(NO_EXPIRATION_EPOCH_SECONDS);
        }
        return now.plusSeconds(timeoutSeconds);
    }

    private Instant activeExpiresAt(Instant now, long activeTimeoutSeconds) {
        return activeTimeoutSeconds <= 0 ? null : now.plusSeconds(activeTimeoutSeconds);
    }

    private String writeJson(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new SecurityAuthenticationException("JWT JSON serialization failed", e);
        }
    }

    private Map<String, Object> readJson(String encoded) {
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(encoded);
            return objectMapper.readValue(decoded, new TypeReference<>() {
            });
        } catch (IllegalArgumentException | IOException e) {
            throw new SecurityAuthenticationException("JWT JSON parsing failed", e);
        }
    }

    private String base64Url(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private String hmac(String signingInput, byte[] secret) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(secret, HMAC_SHA256));
            return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new SecurityAuthenticationException("JWT signature generation failed", e);
        }
    }

}
