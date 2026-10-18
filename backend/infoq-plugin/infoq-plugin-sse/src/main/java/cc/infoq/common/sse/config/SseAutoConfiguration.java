package cc.infoq.common.sse.config;

import cc.infoq.common.security.auth.CurrentUserService;
import cc.infoq.common.security.auth.SecurityTokenResolver;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.sse.controller.SseController;
import cc.infoq.common.sse.core.SseEmitterManager;
import cc.infoq.common.sse.listener.SseTopicListener;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

/**
 * SSE 自动装配
 *
 * @author Pontus
 */
@AutoConfiguration
@ConditionalOnProperty(value = "sse.enabled", havingValue = "true")
@EnableConfigurationProperties(SseProperties.class)
public class SseAutoConfiguration {

    @Bean
    public SseEmitterManager sseEmitterManager() {
        return new SseEmitterManager();
    }

    @Bean
    public SseTopicListener sseTopicListener() {
        return new SseTopicListener();
    }

    @Bean
    public SseController sseController(SseEmitterManager sseEmitterManager,
                                       SecurityTokenResolver tokenResolver,
                                       SecurityTokenService tokenService,
                                       CurrentUserService currentUserService) {
        return new SseController(sseEmitterManager, tokenResolver, tokenService, currentUserService);
    }

}
