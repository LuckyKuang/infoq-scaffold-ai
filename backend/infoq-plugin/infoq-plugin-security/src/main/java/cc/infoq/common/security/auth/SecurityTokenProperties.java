package cc.infoq.common.security.auth;

import cc.infoq.common.utils.StringUtils;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Spring Security 认证令牌配置
 */
@Data
@ConfigurationProperties(prefix = "security.token")
public class SecurityTokenProperties {

    private static final String LEGACY_DEMO_SECRET = "abcdefghijklmnopqrstuvwxyz";

    /**
     * 当前前端客户端使用的请求头名称
     */
    private String tokenName = SecurityAuthNames.AUTHORIZATION;

    /**
     * 认证令牌前缀
     */
    private String tokenPrefix = SecurityAuthNames.BEARER;

    /**
     * HMAC 签名密钥，必须来自外部配置
     */
    private String secret;

    /**
     * 固定令牌有效期，旧版默认值为 30 天
     */
    private Duration ttl = Duration.ofDays(30);

    /**
     * 无操作超时时间，负数表示禁用
     */
    private Duration activeTimeout = Duration.ofSeconds(-1);

    /**
     * 是否允许 SSE/WebSocket 使用查询参数传递令牌
     */
    private boolean queryTokenEnabled = true;

    private String queryTokenName = SecurityAuthNames.AUTHORIZATION;

    private String clientIdHeaderName = SecurityAuthNames.CLIENT_ID;

    private String clientIdQueryName = SecurityAuthNames.CLIENT_ID;

    private String issuer = "infoq-scaffold";

    private Duration allowedClockSkew = Duration.ZERO;

    public byte[] requireSigningSecret() {
        if (StringUtils.isBlank(secret)) {
            throw new SecurityAuthenticationException("security.token.secret is required");
        }
        String normalized = secret.trim();
        if (LEGACY_DEMO_SECRET.equals(normalized)) {
            throw new SecurityAuthenticationException("security.token.secret must not reuse the legacy demo token secret");
        }
        return normalized.getBytes(StandardCharsets.UTF_8);
    }

    public long ttlSeconds() {
        return ttl.getSeconds();
    }

    public long activeTimeoutSeconds() {
        return activeTimeout.getSeconds();
    }

}
