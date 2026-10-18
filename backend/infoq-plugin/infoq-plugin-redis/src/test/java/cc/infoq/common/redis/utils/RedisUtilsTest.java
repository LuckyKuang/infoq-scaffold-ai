package cc.infoq.common.redis.utils;

import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.*;
import org.mockito.Mockito;
import org.redisson.api.*;
import org.redisson.api.listener.MessageListener;
import org.redisson.api.options.KeysScanOptions;
import org.springframework.context.support.GenericApplicationContext;

import java.lang.reflect.Field;
import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class RedisUtilsTest {

    private static RedissonClient redissonClient;
    private static RRateLimiter rateLimiter;
    private static RBucket<?> bucket;
    private static RKeys keys;
    private static RTopic topic;
    private static RList<?> list;
    private static RSet<?> set;
    private static RMap<?, ?> map;
    private static RAtomicLong atomicLong;

    @BeforeAll
    static void initSpringContext() throws Exception {
        redissonClient = mock(RedissonClient.class);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> redissonClient);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        // RedisUtils uses a static final client. If another test class initialized it earlier,
        // we must stub that actual client instance to avoid null-returning default mocks.
        Field clientField = RedisUtils.class.getDeclaredField("CLIENT");
        clientField.setAccessible(true);
        Object actualClient = clientField.get(null);
        if (actualClient instanceof RedissonClient && Mockito.mockingDetails(actualClient).isMock()) {
            redissonClient = (RedissonClient) actualClient;
        }

        rateLimiter = mock(RRateLimiter.class);
        bucket = mock(RBucket.class);
        keys = mock(RKeys.class);
        topic = mock(RTopic.class);
        list = mock(RList.class);
        set = mock(RSet.class);
        map = mock(RMap.class);
        atomicLong = mock(RAtomicLong.class);

        when(redissonClient.getRateLimiter(anyString())).thenReturn(rateLimiter);
        when(redissonClient.getBucket(anyString())).thenAnswer(invocation -> bucket);
        when(redissonClient.getKeys()).thenReturn(keys);
        when(redissonClient.getTopic(anyString())).thenReturn(topic);
        when(redissonClient.getList(anyString())).thenAnswer(invocation -> list);
        when(redissonClient.getSet(anyString())).thenAnswer(invocation -> set);
        when(redissonClient.getMap(anyString())).thenAnswer(invocation -> map);
        when(redissonClient.getAtomicLong(anyString())).thenReturn(atomicLong);
    }

    @BeforeEach
    void clearInteractions() {
        Mockito.clearInvocations(redissonClient, rateLimiter, bucket, keys, topic, list, set, map, atomicLong);
    }

    @Test
    @DisplayName("rateLimiter: should use OSS rate api and expire when timeout is configured")
    void rateLimiterShouldUseOssApiAndExpireWhenTimeoutConfigured() {
        when(rateLimiter.tryAcquire()).thenReturn(true);
        when(rateLimiter.availablePermits()).thenReturn(9L);

        assertEquals(9L, RedisUtils.rateLimiter("limiter", RateType.OVERALL, 10, 60, 300));

        verify(rateLimiter).trySetRate(
            RateType.OVERALL,
            10L,
            Duration.ofSeconds(60)
        );
        verify(rateLimiter).expire(Duration.ofSeconds(300));
    }

    @Test
    @DisplayName("rateLimiter: should skip expire when timeout is not configured")
    void rateLimiterShouldSkipExpireWhenTimeoutIsNotConfigured() {
        when(rateLimiter.tryAcquire()).thenReturn(true);
        when(rateLimiter.availablePermits()).thenReturn(4L);

        assertEquals(4L, RedisUtils.rateLimiter("limiter", RateType.OVERALL, 5, 30));

        verify(rateLimiter).trySetRate(
            RateType.OVERALL,
            5L,
            Duration.ofSeconds(30)
        );
        verify(rateLimiter, never()).expire(any(Duration.class));
    }

    @Test
    @DisplayName("rateLimiter: should return -1 when permits cannot be acquired")
    void rateLimiterShouldReturnMinusOneWhenAcquireFails() {
        when(rateLimiter.tryAcquire()).thenReturn(false);

        assertEquals(-1L, RedisUtils.rateLimiter("limiter", RateType.OVERALL, 10, 1, 1));

        verify(rateLimiter).trySetRate(
            RateType.OVERALL,
            10L,
            Duration.ofSeconds(1)
        );
        verify(rateLimiter).expire(Duration.ofSeconds(1));
    }

    @Test
    @DisplayName("publish: should push message and invoke optional consumer")
    void publishShouldWork() {
        RedisUtils.publish("topic1", "hello", msg -> assertEquals("hello", msg));
        RedisUtils.publish("topic1", "hello2");
        verify(topic).publish("hello");
        verify(topic).publish("hello2");
    }

    @Test
    @DisplayName("getClient/subscribe: should expose client and register topic listener")
    void getClientAndSubscribeShouldWork() {
        AtomicReference<String> messageRef = new AtomicReference<>();
        doAnswer(invocation -> {
            listenerOfString(invocation).onMessage("topic:demo", "payload");
            return 1;
        }).when(topic).addListener(eq(String.class), anyMessageListener());

        RedisUtils.subscribe("topic:demo", String.class, messageRef::set);

        assertSame(redissonClient, RedisUtils.getClient());
        assertEquals("payload", messageRef.get());
    }

    @Test
    @DisplayName("set/get/expire/delete: should delegate common bucket operations")
    void bucketOperationsShouldWork() {
        when(bucket.setIfAbsent(any(), any())).thenReturn(true);
        when(bucket.setIfExists(any(), any())).thenReturn(false);
        when(bucket.expire(any(Duration.class))).thenReturn(true);
        when(bucket.get()).thenAnswer(invocation -> "cached");
        when(bucket.remainTimeToLive()).thenAnswer(invocation -> 1500L);
        when(bucket.delete()).thenReturn(true);
        when(bucket.isExists()).thenReturn(true);

        RedisUtils.setCacheObject("k", "v1");
        RedisUtils.setCacheObject("k", "v2", Duration.ofSeconds(10));
        assertTrue(RedisUtils.setObjectIfAbsent("k", "v1", Duration.ofSeconds(10)));
        assertFalse(RedisUtils.setObjectIfExists("k", "v1", Duration.ofSeconds(10)));
        assertTrue(RedisUtils.expire("k", 20));
        assertEquals("cached", RedisUtils.getCacheObject("k"));
        assertEquals(1500L, RedisUtils.getTimeToLive("k"));
        assertTrue(RedisUtils.deleteObject("k"));
        assertTrue(RedisUtils.isExistsObject("k"));
    }

    @Test
    @DisplayName("setCacheObject keepTTL fallback: should fallback to set with current ttl when keepTTL fails")
    void setCacheObjectKeepTtlFallbackShouldWork() {
        doThrow(new RuntimeException("keep ttl unsupported")).when(bucket).setAndKeepTTL(any());
        when(bucket.remainTimeToLive()).thenAnswer(invocation -> 2000L);

        RedisUtils.setCacheObject("k", "v3", true);
        verify(bucket).set(any(), any());
    }

    @Test
    @DisplayName("setCacheObject keepTTL fallback: should fallback to plain set when ttl is -1")
    void setCacheObjectKeepTtlFallbackWhenNoTtlShouldUsePlainSet() {
        doThrow(new RuntimeException("keep ttl unsupported")).when(bucket).setAndKeepTTL(any());
        when(bucket.remainTimeToLive()).thenAnswer(invocation -> -1L);

        RedisUtils.setCacheObject("k", "v4", true);

        verify(bucket).set(any());
    }

    @Test
    @DisplayName("keys/deleteKeys/hasKey: should query and delete keys by pattern")
    void keyOperationsShouldWork() {
        when(keys.getKeysStream(any(KeysScanOptions.class))).thenReturn(Stream.of("app:k1", "app:k2"));
        when(keys.countExists("app:k1")).thenReturn(1L);

        Collection<String> matched = RedisUtils.keys("app:*");
        RedisUtils.deleteKeys("app:*");

        assertEquals(List.of("app:k1", "app:k2"), matched.stream().toList());
        assertTrue(RedisUtils.hasKey("app:k1"));
        verify(keys).deleteByPattern("app:*");
    }

    @Test
    @DisplayName("delMultiCacheMapValue: should remove every hash key via batch map async")
    void delMultiCacheMapValueShouldRemoveEveryHashKeyViaBatchMapAsync() {
        RBatch batch = mock(RBatch.class);
        RMapAsync<?, ?> mapAsync = mockMapAsync();
        when(redissonClient.createBatch()).thenReturn(batch);
        when(batch.getMap("hash:key")).thenAnswer(invocation -> mapAsync);

        RedisUtils.delMultiCacheMapValue("hash:key", Set.of("f1", "f2"));

        verify(mapAsync, times(2)).removeAsync(any());
        verify(batch).execute();
    }

    @Test
    @DisplayName("deleteObject(collection): should delete all buckets through batch")
    void deleteObjectCollectionShouldUseBatch() {
        RBatch batch = mock(RBatch.class);
        RBucketAsync<?> bucketAsync = mockBucketAsync();
        when(redissonClient.createBatch()).thenReturn(batch);
        when(batch.getBucket(anyString())).thenAnswer(invocation -> bucketAsync);

        RedisUtils.deleteObject(List.of("k1", "k2"));

        verify(batch).getBucket("k1");
        verify(batch).getBucket("k2");
        verify(batch).execute();
    }

    @Test
    @DisplayName("list/set/map/atomic operations: should delegate to corresponding redis structures")
    void listSetMapAndAtomicOperationsShouldWork() {
        ObjectListener listener = mock(ObjectListener.class);

        when(list.addAll(any())).thenReturn(true);
        when(list.add(any())).thenReturn(true);
        when(list.readAll()).thenAnswer(invocation -> List.of("l1", "l2", "l3"));
        when(list.range(anyInt(), anyInt())).thenAnswer(invocation -> List.of("l1", "l2"));

        when(set.addAll(any())).thenReturn(true);
        when(set.add(any())).thenReturn(true);
        when(set.readAll()).thenAnswer(invocation -> Set.of("s1", "s2", "s3"));

        when(map.keySet()).thenAnswer(invocation -> Set.of("f1", "f2"));
        when(map.getAll(any())).thenAnswer(invocation -> {
            Set<?> keys = invocation.getArgument(0);
            if (keys != null && keys.size() == 2) {
                return Map.of("f1", "v1", "f2", "v2");
            }
            return Map.of("f1", "v1");
        });
        when(map.get(any())).thenAnswer(invocation -> "v1");
        when(map.remove(any())).thenAnswer(invocation -> "v1");

        when(atomicLong.get()).thenReturn(10L);
        when(atomicLong.incrementAndGet()).thenReturn(11L);
        when(atomicLong.decrementAndGet()).thenReturn(10L);

        assertTrue(RedisUtils.setCacheList("list:key", List.of("l1", "l2")));
        assertTrue(RedisUtils.addCacheList("list:key", "l3"));
        RedisUtils.addListListener("list:key", listener);
        assertEquals(List.of("l1", "l2", "l3"), RedisUtils.getCacheList("list:key"));
        assertEquals(List.of("l1", "l2"), RedisUtils.getCacheListRange("list:key", 0, 1));

        assertTrue(RedisUtils.setCacheSet("set:key", Set.of("s1", "s2")));
        assertTrue(RedisUtils.addCacheSet("set:key", "s3"));
        RedisUtils.addSetListener("set:key", listener);
        assertEquals(Set.of("s1", "s2", "s3"), RedisUtils.getCacheSet("set:key"));

        RedisUtils.setCacheMap("map:key", Map.of("f1", "v1", "f2", "v2"));
        RedisUtils.setCacheMap("map:key", null);
        RedisUtils.addMapListener("map:key", listener);
        assertEquals(Map.of("f1", "v1", "f2", "v2"), RedisUtils.getCacheMap("map:key"));
        assertEquals(Set.of("f1", "f2"), RedisUtils.getCacheMapKeySet("map:key"));
        RedisUtils.setCacheMapValue("map:key", "f3", "v3");
        assertEquals("v1", RedisUtils.getCacheMapValue("map:key", "f1"));
        assertEquals("v1", RedisUtils.delCacheMapValue("map:key", "f1"));
        assertEquals(Map.of("f1", "v1"), RedisUtils.getMultiCacheMapValue("map:key", Set.of("f1")));

        RedisUtils.addObjectListener("obj:key", listener);

        RedisUtils.setAtomicValue("atomic:key", 10L);
        assertEquals(10L, RedisUtils.getAtomicValue("atomic:key"));
        assertEquals(11L, RedisUtils.incrAtomicValue("atomic:key"));
        assertEquals(10L, RedisUtils.decrAtomicValue("atomic:key"));
    }
    private static MessageListener<String> listenerOfString(org.mockito.invocation.InvocationOnMock invocation) {
        return invocation.getArgument(1);
    }

    private static RMap<?, ?> mockMap() {
        return mock(RMap.class);
    }

    private static RMapAsync<?, ?> mockMapAsync() {
        return mock(RMapAsync.class);
    }

    private static RBucketAsync<?> mockBucketAsync() {
        return mock(RBucketAsync.class);
    }

    private static <T> MessageListener<T> anyMessageListener() {
        return any();
    }
}
