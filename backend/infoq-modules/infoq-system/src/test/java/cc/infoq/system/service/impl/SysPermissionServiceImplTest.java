package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.system.service.SysMenuService;
import cc.infoq.system.service.SysRoleService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysPermissionServiceImplTest {

    @Mock
    private SysRoleService sysRoleService;

    @Mock
    private SysMenuService sysMenuService;

    @Test
    @DisplayName("getRolePermission: should return super-admin role directly")
    void getRolePermissionShouldReturnSuperAdminRole() {
        SysPermissionServiceImpl service = new SysPermissionServiceImpl(sysRoleService, sysMenuService);
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(1L)).thenReturn(true);

            Set<String> roles = service.getRolePermission(1L);

            assertEquals(Set.of(SystemConstants.SUPER_ADMIN_ROLE_KEY), roles);
            verifyNoInteractions(sysRoleService);
        }
    }

    @Test
    @DisplayName("getRolePermission: should delegate to role service for normal user")
    void getRolePermissionShouldDelegateForNormalUser() {
        SysPermissionServiceImpl service = new SysPermissionServiceImpl(sysRoleService, sysMenuService);
        when(sysRoleService.selectRolePermissionByUserId(2L)).thenReturn(Set.of("system:user:list"));
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(2L)).thenReturn(false);

            Set<String> roles = service.getRolePermission(2L);

            assertEquals(Set.of("system:user:list"), roles);
            verify(sysRoleService).selectRolePermissionByUserId(2L);
        }
    }

    @Test
    @DisplayName("getMenuPermission: should return wildcard for super-admin")
    void getMenuPermissionShouldReturnWildcardForSuperAdmin() {
        SysPermissionServiceImpl service = new SysPermissionServiceImpl(sysRoleService, sysMenuService);
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(1L)).thenReturn(true);

            Set<String> perms = service.getMenuPermission(1L);

            assertEquals(Set.of("*:*:*"), perms);
            verifyNoInteractions(sysMenuService);
        }
    }
}
