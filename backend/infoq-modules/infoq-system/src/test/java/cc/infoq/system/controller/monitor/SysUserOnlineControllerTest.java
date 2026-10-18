package cc.infoq.system.controller.monitor;

import cc.infoq.common.constant.CacheConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.dto.UserOnlineDTO;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.redis.utils.RedisUtils;
import cc.infoq.common.security.auth.*;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.entity.SysUserOnline;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.redisson.api.RedissonClient;
import org.springframework.context.support.GenericApplicationContext;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@Tag("dev")
class SysUserOnlineControllerTest {

    private final SecurityTokenService tokenService = mock(SecurityTokenService.class);
    private final SecurityTokenStore tokenStore = mock(SecurityTokenStore.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final SysUserOnlineController controller = new SysUserOnlineController(tokenService, tokenStore, currentUserService);

    @BeforeEach
    void initSpringContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(RedissonClient.class, () -> mock(RedissonClient.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("forceLogout: should revoke target token through security token service")
    void forceLogoutShouldRevokeTargetToken() {
        when(tokenService.revoke("token")).thenReturn(true);

        ApiResult<Void> result = controller.forceLogout("token");

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(tokenService).revoke("token");
    }

    @Test
    @DisplayName("forceLogout: should treat already missing token as idempotent success")
    void forceLogoutShouldTreatMissingTokenAsIdempotentSuccess() {
        when(tokenService.revoke("token")).thenReturn(false);

        ApiResult<Void> result = controller.forceLogout("token");

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(tokenService).revoke("token");
    }

    @Test
    @DisplayName("remove: should revoke token only when token belongs to current login")
    void removeShouldRevokeTokenOnlyWhenTokenBelongsToCurrentLogin() {
        SecurityTokenAuthentication authentication = authentication("sys_user:100");
        SecurityTokenSession targetSession = session("token-target", "sys_user:100", "admin", "127.0.0.1", false);
        when(currentUserService.getAuthentication()).thenReturn(authentication);
        when(tokenService.digest("token-target")).thenReturn("digest-target");
        when(tokenStore.findByDigest("digest-target")).thenReturn(Optional.of(targetSession));

        ApiResult<Void> result = controller.remove("token-target");

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(tokenService).revoke("token-target");
    }

    @Test
    @DisplayName("remove: should not revoke token when token belongs to another login")
    void removeShouldNotRevokeTokenWhenTokenBelongsToAnotherLogin() {
        SecurityTokenAuthentication authentication = authentication("sys_user:100");
        SecurityTokenSession targetSession = session("token-target", "sys_user:200", "other", "10.0.0.5", false);
        when(currentUserService.getAuthentication()).thenReturn(authentication);
        when(tokenService.digest("token-target")).thenReturn("digest-target");
        when(tokenStore.findByDigest("digest-target")).thenReturn(Optional.of(targetSession));

        ApiResult<Void> result = controller.remove("token-target");

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(tokenService, never()).revoke("token-target");
    }

    @Test
    @DisplayName("list: should include only active token-store sessions and apply ip+username filter")
    void listShouldIncludeActiveTokenStoreSessionsAndApplyFilters() {
        SecurityTokenSession active = session("t1", "sys_user:100", "admin", "127.0.0.1", false);
        SecurityTokenSession expired = session("t2", "sys_user:200", "guest", "10.0.0.5", true);
        when(tokenService.digest("t1")).thenReturn("d1");
        when(tokenService.digest("t2")).thenReturn("d2");
        when(tokenStore.findByDigests(argThat(digests -> digests.size() == 2 && digests.containsAll(List.of("d1", "d2")))))
            .thenReturn(Map.of("d1", active, "d2", expired));

        try (MockedStatic<RedisUtils> redisUtils = mockStatic(RedisUtils.class)) {
            redisUtils.when(() -> RedisUtils.keys(CacheConstants.ONLINE_TOKEN_KEY + "*"))
                .thenReturn(List.of(CacheConstants.ONLINE_TOKEN_KEY + "t1", CacheConstants.ONLINE_TOKEN_KEY + "t2"));

            TableDataInfo<SysUserOnline> result = controller.list("127.0.0.1", "admin");

            assertEquals(1, result.getRows().size());
            assertEquals("admin", result.getRows().get(0).getUserName());
            verify(tokenStore).findByDigests(argThat(digests -> digests.size() == 2 && digests.containsAll(List.of("d1", "d2"))));
            verify(tokenStore, never()).findByDigest(anyString());
        }
    }

    @Test
    @DisplayName("list: should filter by username only when ip is empty")
    void listShouldFilterByUsernameOnly() {
        when(tokenService.digest("t1")).thenReturn("d1");
        when(tokenService.digest("t2")).thenReturn("d2");
        when(tokenStore.findByDigests(argThat(digests -> digests.size() == 2 && digests.containsAll(List.of("d1", "d2"))))).thenReturn(Map.of(
            "d1", session("t1", "sys_user:100", "admin", "127.0.0.1", false),
            "d2", session("t2", "sys_user:200", "guest", "10.0.0.5", false)
        ));

        try (MockedStatic<RedisUtils> redisUtils = mockStatic(RedisUtils.class)) {
            redisUtils.when(() -> RedisUtils.keys(CacheConstants.ONLINE_TOKEN_KEY + "*"))
                .thenReturn(List.of(CacheConstants.ONLINE_TOKEN_KEY + "t1", CacheConstants.ONLINE_TOKEN_KEY + "t2"));

            TableDataInfo<SysUserOnline> result = controller.list(null, "guest");

            assertEquals(1, result.getRows().size());
            assertEquals("guest", result.getRows().get(0).getUserName());
            verify(tokenStore).findByDigests(argThat(digests -> digests.size() == 2 && digests.containsAll(List.of("d1", "d2"))));
            verify(tokenStore, never()).findByDigest(anyString());
        }
    }

    @Test
    @DisplayName("getInfo: should return active sessions for current login only")
    void getInfoShouldReturnActiveSessionsForCurrentLoginOnly() {
        when(currentUserService.getAuthentication()).thenReturn(authentication("sys_user:100"));
        when(tokenStore.findTokenDigestsByLoginId("sys_user:100")).thenReturn(new LinkedHashSet<>(List.of("d1", "d2", "d3")));
        when(tokenStore.findByDigests(new LinkedHashSet<>(List.of("d1", "d2", "d3")))).thenReturn(Map.of(
            "d1", session("t1", "sys_user:100", "admin", "127.0.0.1", false),
            "d2", session("t2", "sys_user:100", "admin", "127.0.0.1", true)
        ));

        TableDataInfo<SysUserOnline> result = controller.getInfo();

        assertEquals(1, result.getRows().size());
        assertEquals("t1", result.getRows().get(0).getTokenId());
        assertEquals("admin", result.getRows().get(0).getUserName());
        verify(tokenStore).findByDigests(new LinkedHashSet<>(List.of("d1", "d2", "d3")));
        verify(tokenStore, never()).findByDigest(anyString());
    }

    private SecurityTokenAuthentication authentication(String loginId) {
        SecurityTokenSession session = new SecurityTokenSession();
        session.setLoginId(loginId);
        return new SecurityTokenAuthentication("current-token", "current-digest", null, session);
    }

    private SecurityTokenSession session(String token, String loginId, String username, String ipaddr, boolean expired) {
        UserOnlineDTO online = new UserOnlineDTO();
        online.setTokenId(token);
        online.setUserName(username);
        online.setIpaddr(ipaddr);
        online.setLoginTime(System.currentTimeMillis());
        SecurityTokenSession session = new SecurityTokenSession();
        session.setAccessToken(token);
        session.setTokenDigest("digest-" + token);
        session.setLoginId(loginId);
        session.setUserId(Long.valueOf(loginId.substring(loginId.indexOf(':') + 1)));
        session.setUserType("sys_user");
        session.setClientId("client-1");
        session.setDeviceType("pc");
        session.setLoginTime(online.getLoginTime());
        session.setExpireTime(expired ? System.currentTimeMillis() - 1000L : System.currentTimeMillis() + 60_000L);
        session.setOnlineUser(online);
        return session;
    }
}
