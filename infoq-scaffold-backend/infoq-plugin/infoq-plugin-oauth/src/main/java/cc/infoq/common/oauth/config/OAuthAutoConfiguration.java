package cc.infoq.common.oauth.config;

import cc.infoq.common.oauth.adapter.GitHubOAuthProviderAdapter;
import cc.infoq.common.oauth.adapter.LinuxDoOAuthProviderAdapter;
import cc.infoq.common.oauth.adapter.OAuthProviderAdapter;
import cc.infoq.common.oauth.adapter.OAuthProviderRegistry;
import cc.infoq.common.oauth.config.properties.OAuthProperties;
import cc.infoq.common.oauth.service.OAuthFlowService;
import cc.infoq.common.oauth.service.OAuthLoginTicketService;
import cc.infoq.common.oauth.service.OAuthRedisStateStore;
import org.redisson.api.RedissonClient;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

import java.util.List;

/**
 * OAuth 协议自动配置
 */
@AutoConfiguration
@EnableConfigurationProperties(OAuthProperties.class)
public class OAuthAutoConfiguration {

    @Bean
    public GitHubOAuthProviderAdapter gitHubOAuthProviderAdapter() {
        return new GitHubOAuthProviderAdapter();
    }

    @Bean
    public LinuxDoOAuthProviderAdapter linuxDoOAuthProviderAdapter() {
        return new LinuxDoOAuthProviderAdapter();
    }

    @Bean
    public OAuthProviderRegistry oAuthProviderRegistry(List<OAuthProviderAdapter> adapters) {
        return new OAuthProviderRegistry(adapters);
    }

    @Bean
    public OAuthRedisStateStore oAuthRedisStateStore(RedissonClient redissonClient, OAuthProperties properties) {
        return new OAuthRedisStateStore(redissonClient, properties);
    }

    @Bean
    public OAuthLoginTicketService oAuthLoginTicketService(RedissonClient redissonClient, OAuthProperties properties) {
        return new OAuthLoginTicketService(redissonClient, properties);
    }

    @Bean
    public OAuthFlowService oAuthFlowService(OAuthProperties properties,
                                             OAuthProviderRegistry providerRegistry,
                                             OAuthRedisStateStore stateStore) {
        return new OAuthFlowService(properties, providerRegistry, stateStore);
    }
}
