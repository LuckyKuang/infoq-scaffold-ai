package cc.infoq.common.redis.config;

import cc.infoq.common.redis.manager.PlusSpringCacheManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

@Tag("dev")
class CacheConfigTest {

    @Test
    @DisplayName("cacheManager: should create custom cache manager")
    void cacheManagerShouldBeCreated() {
        CacheConfig config = new CacheConfig();

        CacheManager cacheManager = config.cacheManager();
        assertInstanceOf(PlusSpringCacheManager.class, cacheManager);
    }
}
