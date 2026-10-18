package cc.infoq.common.redis.utils;

import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.SimpleValueWrapper;
import org.springframework.context.support.GenericApplicationContext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("dev")
class CacheUtilsTest {

    private static CacheManager cacheManager;
    private static Cache cache;

    @BeforeAll
    static void initSpringContext() {
        cacheManager = mock(CacheManager.class);
        cache = mock(Cache.class);
        when(cacheManager.getCache("biz-cache")).thenReturn(cache);

        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(CacheManager.class, () -> cacheManager);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("get/put/evict/clear: should delegate cache manager operations")
    void cacheOperationsShouldDelegateToCacheManager() {
        when(cache.get("k1")).thenReturn(new SimpleValueWrapper("v1"));
        when(cache.get("k2")).thenReturn(null);

        assertEquals("v1", CacheUtils.get("biz-cache", "k1", String.class));
        assertNull(CacheUtils.get("biz-cache", "k2", String.class));

        CacheUtils.put("biz-cache", "k3", "v3");
        CacheUtils.evict("biz-cache", "k3");
        CacheUtils.clear("biz-cache");

        verify(cache).put("k3", "v3");
        verify(cache).evict("k3");
        verify(cache).clear();
    }
}
