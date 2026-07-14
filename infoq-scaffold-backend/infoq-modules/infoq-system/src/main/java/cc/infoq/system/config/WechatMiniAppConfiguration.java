package cc.infoq.system.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 微信小程序认证属性注册。
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(WechatMiniAppProperties.class)
public class WechatMiniAppConfiguration {
}
