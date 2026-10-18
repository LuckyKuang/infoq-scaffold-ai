package cc.infoq.common.security.auth;

import cc.infoq.common.domain.model.LoginUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Tag("dev")
class SecurityAuthorizationServiceTest {

    @Test
    @DisplayName("hasPermission: should allow concrete menu permission")
    void hasPermissionShouldAllowConcreteMenuPermission() {
        SecurityAuthorizationService service = service(loginUser(100L, Set.of("system:user:list"), Set.of("admin")));

        assertTrue(service.hasPermission("system:user:list"));
        assertFalse(service.hasPermission("system:user:add"));
    }

    @Test
    @DisplayName("hasPermission: should allow wildcard menu permission")
    void hasPermissionShouldAllowWildcardMenuPermission() {
        SecurityAuthorizationService service = service(loginUser(100L, Set.of("*:*:*"), Set.of("user")));

        assertTrue(service.hasPermission("system:user:remove"));
    }

    @Test
    @DisplayName("hasRole: should allow matching role key")
    void hasRoleShouldAllowMatchingRoleKey() {
        SecurityAuthorizationService service = service(loginUser(100L, Set.of("system:user:list"), Set.of("admin")));

        assertTrue(service.hasRole("admin"));
        assertFalse(service.hasRole("superadmin"));
    }

    @Test
    @DisplayName("authorization: should allow super admin without explicit grants")
    void authorizationShouldAllowSuperAdminWithoutExplicitGrants() {
        SecurityAuthorizationService service = service(loginUser(1L, Set.of(), Set.of()));

        assertTrue(service.hasPermission("system:user:remove"));
        assertTrue(service.hasRole("admin"));
    }

    @Test
    @DisplayName("authorization: should fail explicitly when authentication is missing")
    void authorizationShouldFailExplicitlyWhenAuthenticationMissing() {
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        when(currentUserService.getLoginUser())
            .thenThrow(new SecurityAuthenticationException("Spring Security authentication is missing"));
        SecurityAuthorizationService service = new SecurityAuthorizationService(currentUserService);

        AuthenticationCredentialsNotFoundException ex = assertThrows(
            AuthenticationCredentialsNotFoundException.class,
            () -> service.hasPermission("system:user:list")
        );

        assertTrue(ex.getMessage().contains("Current security authentication is required"));
    }

    private SecurityAuthorizationService service(LoginUser loginUser) {
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        when(currentUserService.getLoginUser()).thenReturn(loginUser);
        when(currentUserService.isSuperAdmin(loginUser.getUserId())).thenCallRealMethod();
        return new SecurityAuthorizationService(currentUserService);
    }

    private LoginUser loginUser(Long userId, Set<String> menuPermissions, Set<String> rolePermissions) {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(userId);
        loginUser.setUserType("sys_user");
        loginUser.setMenuPermission(menuPermissions);
        loginUser.setRolePermission(rolePermissions);
        return loginUser;
    }

}
