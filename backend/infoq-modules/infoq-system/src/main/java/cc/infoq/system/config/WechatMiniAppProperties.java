package cc.infoq.system.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 微信小程序认证配置。
 */
@Data
@ConfigurationProperties("infoq.auth.wechat-miniapp")
public class WechatMiniAppProperties {

    private boolean enabled;

    private String appId;

    private String secret;

    private String sessionEndpoint = "https://api.weixin.qq.com/sns/jscode2session";

    private boolean autoRegisterEnabled;

    private boolean requireInviteWhenInviteRegisterEnabled = true;
}
