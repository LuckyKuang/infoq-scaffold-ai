/**
 * Copyright (c) 2013-2021 Nikita Koksharov
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package cc.infoq.common.redis.manager;

import cc.infoq.common.redis.utils.RedisUtils;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RMap;
import org.redisson.api.RMapCache;
import org.redisson.api.options.LocalCachedMapOptions;
import org.redisson.spring.cache.CacheConfig;
import org.redisson.spring.cache.RedissonCache;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.transaction.TransactionAwareCacheDecorator;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;

/**
 * A {@link org.springframework.cache.CacheManager} implementation
 * backed by Redisson instance.
 * <p>
 * 修改 RedissonSpringCacheManager 源码
 * 重写 cacheName 处理方法 支持多参数
 *
 * @author Pontus
 *
 */
@Slf4j
public class PlusSpringCacheManager implements CacheManager {

    private static final int DEFAULT_LOCAL_CACHE_SIZE = 1000;
    private static final long DEFAULT_LOCAL_CACHE_TTL_MILLIS = TimeUnit.SECONDS.toMillis(30);
    private static final int LOCAL_CACHE_ENABLED = 1;
    private static final int LOCAL_CACHE_DISABLED = 0;

    private boolean dynamic = true;

    private boolean allowNullValues = true;

    private boolean transactionAware = true;

    Map<String, CacheConfig> configMap = new ConcurrentHashMap<>();
    ConcurrentMap<String, Cache> instanceMap = new ConcurrentHashMap<>();

    /**
     * Creates CacheManager supplied by Redisson instance
     */
    public PlusSpringCacheManager() {
    }


    /**
     * Defines possibility of storing {@code null} values.
     * <p>
     * Default is <code>true</code>
     *
     * @param allowNullValues stores if <code>true</code>
     */
    public void setAllowNullValues(boolean allowNullValues) {
        this.allowNullValues = allowNullValues;
    }

    /**
     * Defines if cache aware of Spring-managed transactions.
     * If {@code true} put/evict operations are executed only for successful transaction in after-commit phase.
     * <p>
     * Default is <code>false</code>
     *
     * @param transactionAware cache is transaction aware if <code>true</code>
     */
    public void setTransactionAware(boolean transactionAware) {
        this.transactionAware = transactionAware;
    }

    /**
     * Defines 'fixed' cache names.
     * A new cache instance will not be created in dynamic for non-defined names.
     * <p>
     * `null` parameter setups dynamic mode
     *
     * @param names of caches
     */
    public void setCacheNames(Collection<String> names) {
        if (names != null) {
            for (String name : names) {
                getCache(name);
            }
            dynamic = false;
        } else {
            dynamic = true;
        }
    }

    /**
     * Set cache config mapped by cache name
     *
     * @param config object
     */
    public void setConfig(Map<String, ? extends CacheConfig> config) {
        this.configMap = new ConcurrentHashMap<>(config);
    }

    protected CacheConfig createDefaultConfig() {
        return new CacheConfig();
    }

    @Override
    public Cache getCache(String name) {
        // 重写 cacheName 支持多参数
        String[] array = StringUtils.delimitedListToStringArray(name, "#");
        name = array[0];

        Cache cache = instanceMap.get(name);
        if (cache != null) {
            return cache;
        }
        if (!dynamic) {
            return cache;
        }

        CacheConfig config = configMap.get(name);
        if (config == null) {
            config = createDefaultConfig();
            configMap.put(name, config);
        }

        if (array.length > 1) {
            config.setTTL(DurationStyle.detectAndParse(array[1]).toMillis());
        }
        if (array.length > 2) {
            config.setMaxIdleTime(DurationStyle.detectAndParse(array[2]).toMillis());
        }
        if (array.length > 3) {
            config.setMaxSize(Integer.parseInt(array[3]));
        }
        boolean useMapCache = requiresMapCache(config);
        // Redisson OSS 不支持 Spring Cache 的 local mapCache，未显式指定时默认关闭该路径。
        int local = useMapCache ? LOCAL_CACHE_DISABLED : LOCAL_CACHE_ENABLED;
        if (array.length > 4) {
            local = Integer.parseInt(array[4]);
        }

        if (useMapCache && local == LOCAL_CACHE_ENABLED) {
            log.warn("cache '{}' requested local mapCache, but Redisson OSS supports only plain mapCache for TTL/maxIdle/maxSize caches; forcing plain mapCache", name);
            local = LOCAL_CACHE_DISABLED;
        }

        if (!useMapCache) {
            return createMap(name, local);
        }

        return createMapCache(name, config);
    }

    private Cache createMap(String name, int local) {
        RMap<Object, Object> map = local == LOCAL_CACHE_ENABLED
            ? RedisUtils.getClient().getLocalCachedMap(createLocalCachedMapOptions(name))
            : RedisUtils.getClient().getMap(name);

        Cache cache = new RedissonCache(map, allowNullValues);
        if (transactionAware) {
            cache = new TransactionAwareCacheDecorator(cache);
        }
        Cache oldCache = instanceMap.putIfAbsent(name, cache);
        if (oldCache != null) {
            cache = oldCache;
        }
        return cache;
    }

    private Cache createMapCache(String name, CacheConfig config) {
        RMapCache<Object, Object> map = RedisUtils.getClient().getMapCache(name);

        Cache cache = new RedissonCache(map, config, allowNullValues);
        if (transactionAware) {
            cache = new TransactionAwareCacheDecorator(cache);
        }
        Cache oldCache = instanceMap.putIfAbsent(name, cache);
        if (oldCache != null) {
            cache = oldCache;
        } else {
            map.setMaxSize(config.getMaxSize());
        }
        return cache;
    }

    private boolean requiresMapCache(CacheConfig config) {
        return config.getMaxIdleTime() != 0 || config.getTTL() != 0 || config.getMaxSize() != 0;
    }

    private LocalCachedMapOptions<Object, Object> createLocalCachedMapOptions(String name) {
        return LocalCachedMapOptions.<Object, Object>name(name)
            .cacheProvider(LocalCachedMapOptions.CacheProvider.CAFFEINE)
            .storeMode(LocalCachedMapOptions.StoreMode.LOCALCACHE_REDIS)
            .syncStrategy(LocalCachedMapOptions.SyncStrategy.INVALIDATE)
            .reconnectionStrategy(LocalCachedMapOptions.ReconnectionStrategy.CLEAR)
            .evictionPolicy(LocalCachedMapOptions.EvictionPolicy.LRU)
            .cacheSize(DEFAULT_LOCAL_CACHE_SIZE)
            .timeToLive(Duration.ofMillis(DEFAULT_LOCAL_CACHE_TTL_MILLIS))
            .expirationEventPolicy(LocalCachedMapOptions.ExpirationEventPolicy.SUBSCRIBE_WITH_KEYEVENT_PATTERN);
    }

    @Override
    public Collection<String> getCacheNames() {
        return Collections.unmodifiableSet(configMap.keySet());
    }


}
