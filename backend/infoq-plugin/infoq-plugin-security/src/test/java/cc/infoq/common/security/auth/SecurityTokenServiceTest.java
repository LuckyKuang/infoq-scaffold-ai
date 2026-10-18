package cc.infoq.common.security.auth;

import cc.infoq.common.domain.dto.RoleDTO;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.exception.SecurityDependencyException;
import org.redisson.client.RedisException;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Tag("dev")
class SecurityTokenServiceTest {

    @Test
    void revocationDependencyFailuresKeepOperationAndTypeWithoutRedisArguments() {
        SecurityTokenStore store = mock(SecurityTokenStore.class);
        var dependencyFailure = new RedisException("sensitive-command-marker access-token");
        when(store.revokeByUserId(20L)).thenThrow(dependencyFailure);
        when(store.revokeByUserIds(List.of(20L, 21L))).thenThrow(dependencyFailure);
        when(store.revokeByRoleId(6L)).thenThrow(dependencyFailure);
        var service = new SecurityTokenService(properties(), store);
        List<java.util.function.Supplier<Integer>> operations = List.of(
            () -> service.revokeByUserId(20L),
            () -> service.revokeByUserIds(List.of(20L, 21L)),
            () -> service.revokeByRoleId(6L));
        List<String> operationNames = List.of("revoke_user", "revoke_users", "revoke_role");
        for (int index = 0; index < operations.size(); index++) {
            var operation = operations.get(index);
            var exception = assertThrows(SecurityDependencyException.class, operation::get);
            assertEquals(operationNames.get(index), exception.operation());
            assertEquals("RedisException", exception.dependencyType());
            assertNull(exception.getCause());
            var stack = new java.io.StringWriter();
            exception.printStackTrace(new java.io.PrintWriter(stack));
            assertFalse(stack.toString().contains("sensitive-command-marker"));
            assertFalse(stack.toString().contains("access-token"));
        }
    }

    @Test
    void revocationDoesNotDisguiseProgrammingErrorsAsDependencyFailures() {
        SecurityTokenStore store = mock(SecurityTokenStore.class);
        var failure = new IllegalArgumentException("invalid user reference");
        when(store.revokeByUserId(20L)).thenThrow(failure);
        var service = new SecurityTokenService(properties(), store);
        assertSame(failure, assertThrows(IllegalArgumentException.class, () -> service.revokeByUserId(20L)));
    }

    @Test
    @DisplayName("issue/parse: should create jwt with light claims and store full LoginUser session")
    void issueParseShouldCreateLightJwtAndStoreFullLoginUserSession() {
        SecurityTokenProperties properties = properties();
        SecurityTokenStore store = mock(SecurityTokenStore.class);
        when(store.extractRoleIds(any(LoginUser.class))).thenCallRealMethod();
        SecurityTokenService tokenService = new SecurityTokenService(
            properties,
            store,
            new ObjectMapper(),
            Clock.fixed(Instant.parse("2026-05-26T00:00:00Z"), ZoneOffset.UTC)
        );
        LoginUser loginUser = loginUser();

        SecurityIssuedToken issued = tokenService.issue(
            new SecurityTokenIssueRequest(loginUser, "client-1", "pc", 1800L, 300L, null)
        );
        SecurityTokenClaims claims = tokenService.parse(issued.accessToken());

        assertNotNull(issued.accessToken());
        assertEquals(1800L, issued.expiresIn());
        assertEquals("sys_user:1", claims.loginId());
        assertEquals(1L, claims.userId());
        assertEquals("sys_user", claims.userType());
        assertEquals("client-1", claims.clientId());
        assertEquals("pc", claims.deviceType());
        assertEquals(Instant.parse("2026-05-26T00:30:00Z"), claims.expiresAt());
        assertEquals(Instant.parse("2026-05-26T00:05:00Z"), claims.activeExpiresAt());

        ArgumentCaptor<SecurityTokenSession> sessionCaptor = ArgumentCaptor.forClass(SecurityTokenSession.class);
        verify(store).save(eq(issued.accessToken()), sessionCaptor.capture());
        SecurityTokenSession session = sessionCaptor.getValue();
        assertEquals(issued.accessToken(), session.getAccessToken());
        assertEquals(issued.tokenDigest(), session.getTokenDigest());
        assertSame(loginUser, session.getLoginUser());
        assertEquals(Set.of(10L), session.getRoleIds());
        assertEquals("client-1", loginUser.getClientKey());
        assertEquals("pc", loginUser.getDeviceType());
    }

    @Test
    @DisplayName("issue: should issue a new token on every login")
    void issueShouldCreateNewTokenEachTime() {
        SecurityTokenStore store = mock(SecurityTokenStore.class);
        SecurityTokenService tokenService = new SecurityTokenService(
            properties(),
            store,
            new ObjectMapper(),
            Clock.fixed(Instant.parse("2026-05-26T00:00:00Z"), ZoneOffset.UTC)
        );

        SecurityIssuedToken first = tokenService.issue(new SecurityTokenIssueRequest(loginUser(), "client-1", "pc", 1800L, -1L, null));
        SecurityIssuedToken second = tokenService.issue(new SecurityTokenIssueRequest(loginUser(), "client-1", "pc", 1800L, -1L, null));

        assertNotEquals(first.accessToken(), second.accessToken());
        assertNotEquals(first.jwtId(), second.jwtId());
        verify(store, times(2)).save(anyString(), any(SecurityTokenSession.class));
    }

    @Test
    @DisplayName("authenticate: should skip active timeout touch when stored timestamps are inconsistent")
    void authenticateShouldSkipActiveTouchWhenStoredTimestampsAreInconsistent() {
        SecurityTokenStore store = mock(SecurityTokenStore.class);
        when(store.extractRoleIds(any(LoginUser.class))).thenCallRealMethod();
        SecurityTokenService tokenService = new SecurityTokenService(
            properties(),
            store,
            new ObjectMapper(),
            Clock.fixed(Instant.parse("2026-05-26T00:00:00Z"), ZoneOffset.UTC)
        );
        SecurityIssuedToken issued = tokenService.issue(
            new SecurityTokenIssueRequest(loginUser(), "client-1", "pc", 1800L, 300L, null)
        );
        ArgumentCaptor<SecurityTokenSession> sessionCaptor = ArgumentCaptor.forClass(SecurityTokenSession.class);
        verify(store).save(eq(issued.accessToken()), sessionCaptor.capture());
        SecurityTokenSession session = sessionCaptor.getValue();
        session.setLastAccessTime(session.getActiveExpireTime() + 1000L);
        when(store.findByDigest(issued.tokenDigest())).thenReturn(Optional.of(session));

        SecurityTokenAuthentication authentication = tokenService.authenticate(issued.accessToken(), "client-1");

        assertEquals(issued.tokenDigest(), authentication.tokenDigest());
        verify(store, never()).touch(any(SecurityTokenSession.class), any(Duration.class));
    }

    private SecurityTokenProperties properties() {
        SecurityTokenProperties properties = new SecurityTokenProperties();
        properties.setSecret("local-test-token-secret");
        properties.setTtl(Duration.ofMinutes(30));
        properties.setActiveTimeout(Duration.ofMinutes(5));
        return properties;
    }

    private LoginUser loginUser() {
        RoleDTO role = new RoleDTO();
        role.setRoleId(10L);
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(1L);
        loginUser.setUserType("sys_user");
        loginUser.setUsername("admin");
        loginUser.setRoles(List.of(role));
        loginUser.setMenuPermission(Set.of("system:user:list"));
        loginUser.setRolePermission(Set.of("admin"));
        return loginUser;
    }

}
