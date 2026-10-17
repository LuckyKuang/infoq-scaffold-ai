package cc.infoq.common.oauth.config.properties;

import cc.infoq.common.utils.StringUtils;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * OAuth 登录配置
 */
@Data
@ConfigurationProperties(prefix = "oauth")
public class OAuthProperties {

    /**
     * OAuth 登录全局开关
     */
    private Boolean enabled = false;

    /**
     * 待授权 state 有效期
     */
    private Duration stateTtl = Duration.ofMinutes(10);

    /**
     * 登录票据有效期
     */
    private Duration ticketTtl = Duration.ofMinutes(2);

    /**
     * OAuth 身份自动注册全局开关
     */
    private Boolean autoRegisterEnabled = true;

    /**
     * 邀请注册开启时是否拒绝 OAuth 自动注册
     */
    private Boolean requireInviteWhenInviteRegisterEnabled = true;

    /**
     * 前端回调路由，保持同源相对路径
     */
    private String frontendCallbackPath = "/oauth/callback";

    /**
     * 提供方客户端配置，按提供方编码索引
     */
    private Map<String, Provider> providers = new LinkedHashMap<>();

    public boolean isEnabled() {
        return Boolean.TRUE.equals(enabled);
    }

    public boolean isAutoRegisterEnabled() {
        return Boolean.TRUE.equals(autoRegisterEnabled);
    }

    public boolean isRequireInviteWhenInviteRegisterEnabled() {
        return Boolean.TRUE.equals(requireInviteWhenInviteRegisterEnabled);
    }

    @Data
    public static class Provider {

        private String clientId;

        private String clientSecret;

        private String redirectUri;

        private String authorizeUri;

        private String tokenUri;

        private String userInfoUri;

        private List<String> scopes = new ArrayList<>();

        private Boolean pkceEnabled = true;

        public boolean hasClientSettings() {
            return StringUtils.isNotBlank(clientId)
                && StringUtils.isNotBlank(clientSecret)
                && StringUtils.isNotBlank(redirectUri);
        }

        public boolean isPkceEnabled() {
            return Boolean.TRUE.equals(pkceEnabled);
        }
    }
}
