package cc.infoq.common.redis.config;

import cc.infoq.common.redis.manager.PlusSpringCacheManager;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;

/**
 * 缓存配置
 *
 * @author Pontus
 */
@AutoConfiguration
@EnableCaching
public class CacheConfig {

    /**
     * 自定义缓存管理器，整合 spring-cache 与 Redisson OSS 兼容缓存路径
     */
    @Bean
    public CacheManager cacheManager() {
        return new PlusSpringCacheManager();
    }

}
