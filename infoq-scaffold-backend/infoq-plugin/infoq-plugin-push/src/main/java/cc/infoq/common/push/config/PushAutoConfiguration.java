package cc.infoq.common.push.config;

import cc.infoq.common.push.service.DefaultPushService;
import cc.infoq.common.push.service.PushService;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;

@AutoConfiguration
@ConditionalOnProperty(prefix = "infoq.push", name = "enabled", havingValue = "true")
@EnableConfigurationProperties(PushProperties.class)
public class PushAutoConfiguration {

    @Bean
    public InitializingBean pushConfigurationValidator(PushProperties properties, Environment environment) {
        return () -> {
            if (!properties.isSseEnabled() && !properties.isWebsocketEnabled()) {
                throw new IllegalStateException("infoq.push.enabled=true requires an enabled Push channel");
            }
            if (properties.isSseEnabled() && !environment.getProperty("sse.enabled", Boolean.class, false)) {
                throw new IllegalStateException("infoq.push.sse-enabled=true requires sse.enabled=true");
            }
            if (properties.isWebsocketEnabled() && !environment.getProperty("websocket.enabled", Boolean.class, false)) {
                throw new IllegalStateException("infoq.push.websocket-enabled=true requires websocket.enabled=true");
            }
        };
    }

    @Bean
    public PushService pushService(PushProperties properties) {
        return new DefaultPushService(properties);
    }
}
