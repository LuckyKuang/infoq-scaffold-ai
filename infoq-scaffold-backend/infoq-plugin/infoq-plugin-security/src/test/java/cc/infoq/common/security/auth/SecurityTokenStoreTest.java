package cc.infoq.common.security.auth;

import cc.infoq.common.constant.CacheConstants;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.utils.SpringUtils;
import org.junit.jupiter.api.*;
import org.redisson.api.RBucket;
import org.redisson.api.RBuckets;
import org.redisson.api.RSet;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;

import java.lang.reflect.Field;
import java.time.Duration;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class SecurityTokenStoreTest {

    private static RedissonClient redissonClient;
    private static RBucket<Object> bucket;
    private static RBuckets buckets;
    private static RSet<String> set;

    @BeforeAll
    @SuppressWarnings("unchecked")
    static void initSpringContext() throws Exception {
        RedissonClient contextClient = mock(RedissonClient.class);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> contextClient);
        context.refresh();
        new SpringUtils().setApplicationContext(context);

        Field clientField = RedisUtils.class.getDeclaredField("CLIENT");
        clientField.setAccessible(true);
        redissonClient = (RedissonClient) clientField.get(null);

        bucket = mock(RBucket.class);
        buckets = mock(RBuckets.class);
        set = mock(RSet.class);
        when(redissonClient.getBucket(anyString())).thenAnswer(invocation -> bucket);
        when(redissonClient.getBuckets()).thenReturn(buckets);
        when(redissonClient.<String>getSet(anyString())).thenAnswer(invocation -> set);
        when(set.expire(any(Duration.class))).thenReturn(true);
    }

    @BeforeEach
    void clearInteractions() {
        clearInvocations(redissonClient, bucket, buckets, set);
    }

    @Test
    @DisplayName("digest/key: should use sha256 digest as internal redis key")
    void digestKeyShouldUseSha256DigestAsInternalRedisKey() {
        SecurityTokenStore store = new SecurityTokenStore();
        SecurityTokenService tokenService = new SecurityTokenService(properties(), mock(SecurityTokenStore.class));

        String digest = tokenService.digest("clear-access-token");

        assertEquals(64, digest.length());
        assertFalse(digest.contains("clear-access-token"));
        assertEquals(digest, tokenService.digest("clear-access-token"));
        assertEquals(SecurityAuthNames.TOKEN_SESSION_KEY_PREFIX + digest, store.sessionKey(digest));
        assertEquals(SecurityAuthNames.TOKEN_REVOKED_KEY_PREFIX + digest, store.revokedKey(digest));
        assertEquals(SecurityAuthNames.TOKEN_LOGIN_INDEX_KEY_PREFIX + "sys_user:1", store.loginIndexKey("sys_user:1"));
        assertEquals(SecurityAuthNames.TOKEN_USER_INDEX_KEY_PREFIX + "1", store.userIndexKey(1L));
        assertEquals(SecurityAuthNames.TOKEN_ROLE_INDEX_KEY_PREFIX + "2", store.roleIndexKey(2L));
    }

    @Test
    @DisplayName("save: should write session by digest and legacy online key by clear token")
    void saveShouldWriteSessionByDigestAndLegacyOnlineKeyByClearToken() {
        SecurityTokenStore store = new SecurityTokenStore();
        SecurityTokenSession session = session("digest-1");

        store.save("clear-access-token", session);

        verify(redissonClient).getBucket(store.sessionKey("digest-1"));
        verify(redissonClient).getBucket(CacheConstants.ONLINE_TOKEN_KEY + "clear-access-token");
        verify(bucket).set(eq(session), any(Duration.class));
        verify(bucket).set(argThat(value ->
            value instanceof UserOnlineDTO dto && "clear-access-token".equals(dto.getTokenId())
        ), any(Duration.class));
        verify(redissonClient, times(2)).getSet(store.loginIndexKey("sys_user:1"));
        verify(redissonClient, times(2)).getSet(store.userIndexKey(1L));
        verify(set, times(2)).add("digest-1");
        verify(set, times(2)).expire(any(Duration.class));
    }

    @Test
    @DisplayName("revokeByUserId: should batch load sessions by indexed digests")
    void revokeByUserIdShouldBatchLoadSessionsByIndexedDigests() {
        SecurityTokenStore store = new SecurityTokenStore();
        SecurityTokenSession session = session("digest-1");
        when(set.readAll()).thenReturn(Set.of("digest-1", "digest-missing"));
        when(buckets.get(any(String[].class))).thenReturn(Map.of(store.sessionKey("digest-1"), session));

        int count = store.revokeByUserId(1L);

        assertEquals(1, count);
        verify(redissonClient, times(2)).getSet(store.userIndexKey(1L));
        verify(set).readAll();
        verify(buckets).get(any(String[].class));
        verify(bucket, never()).get();
        verify(redissonClient).getBucket(store.sessionKey("digest-1"));
        verify(redissonClient).getBucket(store.sessionKey("digest-missing"));
        verify(bucket, times(3)).delete();
        verify(set, times(2)).remove("digest-1");
    }

    private SecurityTokenProperties properties() {
        SecurityTokenProperties properties = new SecurityTokenProperties();
        properties.setSecret("local-test-token-secret");
        return properties;
    }

    private SecurityTokenSession session(String digest) {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(1L);
        loginUser.setUserType("sys_user");
        loginUser.setUsername("admin");
        loginUser.setClientKey("client-1");
        loginUser.setDeviceType("pc");
        SecurityTokenSession session = new SecurityTokenSession();
        session.setJwtId("jwt-1");
        session.setAccessToken("clear-access-token");
        session.setTokenDigest(digest);
        session.setLoginId("sys_user:1");
        session.setUserId(1L);
        session.setUserType("sys_user");
        session.setClientId("client-1");
        session.setDeviceType("pc");
        session.setLoginTime(System.currentTimeMillis());
        session.setExpireTime(System.currentTimeMillis() + 60_000L);
        session.setLoginUser(loginUser);
        return session;
    }

}
