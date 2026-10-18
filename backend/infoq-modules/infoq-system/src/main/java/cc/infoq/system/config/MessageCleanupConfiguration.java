package cc.infoq.system.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(MessageCleanupProperties.class)
public class MessageCleanupConfiguration {
}
