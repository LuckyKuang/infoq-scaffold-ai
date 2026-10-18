package cc.infoq.common.security.browser;

import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.redis.config.RedisConfig;
import cc.infoq.common.redis.config.properties.RedissonProperties;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.security.auth.*;
import cc.infoq.common.utils.SpringUtils;
import io.netty.buffer.ByteBuf;
import org.junit.jupiter.api.*;
import org.mockito.MockedStatic;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class BrowserSessionServiceTest {
    private final Map<String, SecurityTokenSession> tokens = new HashMap<>();
    private final Map<String, BrowserSessionStore.Binding> bindings = new HashMap<>();
    private final BrowserSessionProperties properties = new BrowserSessionProperties();
    private final BrowserSessionStore store = spy(new BrowserSessionStore() {
        @Override public Binding find(String handle) { return bindings.get(handle); }
        @Override public void save(String handle, Binding value, Duration ttl) { bindings.put(handle, value); }
        @Override public void delete(String handle) { bindings.remove(handle); }
    });
    private final SecurityTokenStore tokenStore = new SecurityTokenStore() {
        @Override public void save(String accessToken, SecurityTokenSession session) { tokens.put(session.getTokenDigest(), session); }
        @Override public Optional<SecurityTokenSession> findByDigest(String digest) { return Optional.ofNullable(tokens.get(digest)); }
        @Override public boolean revoke(String token, String digest) { return tokens.remove(digest) != null; }
    };
    private final SecurityTokenService tokenService;
    private final BrowserSessionService service;

    BrowserSessionServiceTest() {
        SecurityTokenProperties tokenProperties = new SecurityTokenProperties();
        tokenProperties.setSecret("isolated-browser-session-unit-test-secret");
        tokenService = new SecurityTokenService(tokenProperties, tokenStore);
        service = new BrowserSessionService(properties, store, tokenStore, tokenService);
    }

    @Test
    void restoreReturnsSameSignedTokenAndDoesNotExtendBinding() {
        var auth = issue(3600L);
        var created = service.bind(auth, "pc", "react", null);
        assertTrue(BrowserSessionService.validHandle(created.handle()));
        assertEquals(32, Base64.getUrlDecoder().decode(created.handle()).length);
        BrowserSessionStore.Binding original = bindings.get(created.handle());
        long expiry = original.getExpiresAt();
        var restored = service.restore(created.handle(), "pc", "react");
        assertEquals(auth.accessToken(), restored.authentication().accessToken());
        assertEquals(expiry, bindings.get(created.handle()).getExpiresAt());
        assertTrue(restored.remainingSeconds() > 0 && restored.remainingSeconds() <= 3600);
        assertEquals(auth.tokenDigest(), original.getTokenDigest());
        assertFalse(original.toString().contains(auth.accessToken()));
        verify(store, times(1)).save(anyString(), any(), any());
    }

    @Test
    void unboundedJwtCannotCreateUnboundedRecoveryLifetime() {
        properties.setTtlSeconds(50);
        var created = service.bind(issue(-1L), "pc", "react", null);
        assertEquals(50, created.maxAge());
        assertTrue(service.restore(created.handle(), "pc", "react").remainingSeconds() <= 50);
    }

    @Test
    void expiredAndRevokedSessionsCannotBeRecovered() {
        var auth = issue(3600L);
        var created = service.bind(auth, "pc", "react", null);
        tokenService.revoke(auth.accessToken());
        assertEquals(401, assertThrows(BrowserSessionException.class,
            () -> service.restore(created.handle(), "pc", "react")).status());
        assertFalse(bindings.containsKey(created.handle()));
        var active = issue(3600L);
        var next = service.bind(active, "pc", "react", null);
        active.session().setActiveExpireTime(System.currentTimeMillis() - 1000);
        assertThrows(BrowserSessionException.class, () -> service.restore(next.handle(), "pc", "react"));
        assertFalse(tokens.containsKey(active.tokenDigest()));
    }

    @Test
    void expiredRecoveryDeletesMappingWithoutRenewingJwt() {
        var auth = issue(3600L);
        var created = service.bind(auth, "pc", "react", null);
        Clock future = Clock.fixed(Instant.ofEpochMilli(bindings.get(created.handle()).getExpiresAt() + 1), ZoneOffset.UTC);
        var futureService = new BrowserSessionService(properties, store, tokenStore, tokenService, future);
        assertThrows(BrowserSessionException.class, () -> futureService.restore(created.handle(), "pc", "react"));
        assertFalse(bindings.containsKey(created.handle()));
    }

    @Test
    void applicationsAreIsolatedAndSameApplicationRebindRevokesOnlyItsPreviousToken() {
        var first = issue(3600L);
        var second = issue(3600L);
        var react = service.bind(first, "pc", "react", null);
        var vue = service.bind(second, "pc", "vue", null);
        assertThrows(BrowserSessionException.class, () -> service.restore(react.handle(), "pc", "vue"));
        assertTrue(bindings.containsKey(react.handle()));
        var replacement = issue(3600L);
        service.bind(replacement, "pc", "react", react.handle());
        assertFalse(tokens.containsKey(first.tokenDigest()));
        assertFalse(bindings.containsKey(react.handle()));
        assertEquals(second.accessToken(), service.restore(vue.handle(), "pc", "vue").authentication().accessToken());
        assertTrue(service.delete(vue.handle(), "pc", "vue").isPresent());
        assertTrue(service.delete(vue.handle(), "pc", "vue").isEmpty());
        assertTrue(service.delete(null, "pc", "vue").isEmpty());
    }

    @Test
    void clientMismatchInvalidatesRecoveryAndDependencyFailureIsNotAnonymous() {
        var created = service.bind(issue(3600L), "pc", "react", null);
        assertThrows(BrowserSessionException.class, () -> service.restore(created.handle(), "other", "react"));
        assertFalse(bindings.containsKey(created.handle()));
        doThrow(new org.redisson.client.RedisException("isolated dependency failure")).when(store).find(anyString());
        assertThrows(org.redisson.client.RedisException.class, () -> service.restore(created.handle(), "pc", "react"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void redisStoreUsesOssSetIfAbsentWithBoundedTtlAndDigestKey() {
        var context = new org.springframework.context.support.GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> mock(RedissonClient.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        RedissonClient client = RedisUtils.getClient();
        RBucket<Object> bucket = mock(RBucket.class);
        when(client.getBucket(anyString())).thenReturn(bucket);
        when(bucket.setIfAbsent(any(), any(Duration.class))).thenReturn(true);
        clearInvocations(client);
        try {
            BrowserSessionStore actual = new BrowserSessionStore();
            var binding = new BrowserSessionStore.Binding("token-digest", "pc", "react", 123L);
            actual.save("opaque-secret", binding, Duration.ofSeconds(5));
            verify(client).getBucket("security:browser-session:" + BrowserSessionCookies.digest("opaque-secret"));
            verify(bucket).setIfAbsent(binding, Duration.ofSeconds(5));
            assertFalse(actual.key("opaque-secret").contains("opaque-secret"));
        } finally {
            context.close();
        }
    }

    @Test
    void mappingRoundTripsThroughActualConfiguredRedisCodec() throws Exception {
        RedisConfig redisConfig = new RedisConfig();
        RedissonProperties redisProperties = new RedissonProperties();
        redisProperties.setThreads(1);
        redisProperties.setNettyThreads(1);
        ReflectionTestUtils.setField(redisConfig, "redissonProperties", redisProperties);
        Config config = new Config();
        try (MockedStatic<SpringUtils> spring = mockStatic(SpringUtils.class)) {
            spring.when(SpringUtils::isVirtual).thenReturn(false);
            redisConfig.redissonCustomizer().customize(config);
        }
        var binding = new BrowserSessionStore.Binding("digest", "pc", "react", 123L);
        ByteBuf encoded = config.getCodec().getValueEncoder().encode(binding);
        try {
            assertEquals(binding, config.getCodec().getValueDecoder().decode(encoded, null));
        } finally {
            encoded.release();
        }
    }

    private SecurityTokenAuthentication issue(long timeout) {
        LoginUser user = new LoginUser();
        user.setUserId(1L);
        user.setUserType("sys_user");
        user.setUsername("admin");
        var issued = tokenService.issue(new SecurityTokenIssueRequest(user, "pc", "pc", timeout, -1L, null));
        return tokenService.authenticate(issued.accessToken(), "pc");
    }
}
