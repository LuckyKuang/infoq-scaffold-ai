package cc.infoq.common.redis.utils;

import cc.infoq.common.utils.SpringUtils;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

/**
 * 缓存操作工具类
 *
 * @author Pontus
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class CacheUtils {

    private static final CacheManager CACHE_MANAGER = SpringUtils.getBean(CacheManager.class);

    /**
     * 获取缓存值
     *
     * @param cacheNames 缓存组名称
     * @param key        缓存key
     * @param type       期望的值类型
     * @param <T>        缓存值类型
     */
    public static <T> T get(String cacheNames, Object key, Class<T> type) {
        Cache.ValueWrapper wrapper = CACHE_MANAGER.getCache(cacheNames).get(key);
        return wrapper != null ? type.cast(wrapper.get()) : null;
    }

    /**
     * 保存缓存值
     *
     * @param cacheNames 缓存组名称
     * @param key        缓存key
     * @param value      缓存值
     */
    public static void put(String cacheNames, Object key, Object value) {
        CACHE_MANAGER.getCache(cacheNames).put(key, value);
    }

    /**
     * 删除缓存值
     *
     * @param cacheNames 缓存组名称
     * @param key        缓存key
     */
    public static void evict(String cacheNames, Object key) {
        CACHE_MANAGER.getCache(cacheNames).evict(key);
    }

    /**
     * 清空缓存值
     *
     * @param cacheNames 缓存组名称
     */
    public static void clear(String cacheNames) {
        CACHE_MANAGER.getCache(cacheNames).clear();
    }

}
