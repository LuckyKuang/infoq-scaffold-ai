package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.security.auth.SecurityTokenService;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysRoleBo;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.domain.entity.SysUserRole;
import cc.infoq.system.domain.vo.SysRoleVo;
import cc.infoq.system.mapper.SysRoleDeptMapper;
import cc.infoq.system.mapper.SysRoleMapper;
import cc.infoq.system.mapper.SysRoleMenuMapper;
import cc.infoq.system.mapper.SysUserRoleMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.github.linpeilie.Converter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysRoleServiceImplTest {

    @Mock
    private SysRoleMapper sysRoleMapper;

    @Mock
    private SysRoleMenuMapper sysRoleMenuMapper;

    @Mock
    private SysUserRoleMapper sysUserRoleMapper;

    @Mock
    private SysRoleDeptMapper sysRoleDeptMapper;

    @Mock
    private SecurityTokenService securityTokenService;

    @BeforeEach
    void setUp() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> mock(Converter.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("selectRolePermissionByUserId: should split role keys into permission set")
    void selectRolePermissionByUserIdShouldSplitKeys() {
        SysRoleServiceImpl service = newService();
        SysRoleVo roleA = new SysRoleVo();
        roleA.setRoleKey("system:user:list,system:user:add");
        SysRoleVo roleB = new SysRoleVo();
        roleB.setRoleKey("system:role:list");
        when(sysRoleMapper.selectRolesByUserId(10L)).thenReturn(List.of(roleA, roleB));

        Set<String> perms = service.selectRolePermissionByUserId(10L);

        assertEquals(Set.of("system:user:list", "system:user:add", "system:role:list"), perms);
    }

    @Test
    @DisplayName("checkRoleAllowed: should reject reserved role keys for new role")
    void checkRoleAllowedShouldRejectReservedRoleKey() {
        SysRoleServiceImpl service = newService();
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(null);
        bo.setRoleKey("admin");

        assertThrows(ServiceException.class, () -> service.checkRoleAllowed(bo));
    }

    @Test
    @DisplayName("checkRoleAllowed: should allow normal custom role key")
    void checkRoleAllowedShouldAllowNormalRoleKey() {
        SysRoleServiceImpl service = newService();
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(null);
        bo.setRoleKey("ops_manager");

        assertDoesNotThrow(() -> service.checkRoleAllowed(bo));
    }

    @Test
    @DisplayName("selectRolesAuthByUserId: should mark owned roles with flag=true")
    void selectRolesAuthByUserIdShouldMarkOwnedRoles() {
        SysRoleServiceImpl service = newService();
        SysRoleVo owned = new SysRoleVo();
        owned.setRoleId(1L);
        owned.setRoleName("管理员");
        SysRoleVo all1 = new SysRoleVo();
        all1.setRoleId(1L);
        all1.setRoleName("管理员");
        SysRoleVo all2 = new SysRoleVo();
        all2.setRoleId(2L);
        all2.setRoleName("审计员");
        when(sysRoleMapper.selectRolesByUserId(10L)).thenReturn(List.of(owned));
        when(sysRoleMapper.selectRoleList(any())).thenReturn(List.of(all1, all2));

        List<SysRoleVo> list = service.selectRolesAuthByUserId(10L);

        assertEquals(2, list.size());
        assertTrue(list.get(0).isFlag());
        assertFalse(list.get(1).isFlag());
    }

    @Test
    @DisplayName("selectPageRoleList/selectRoleListByUserId: should delegate and map ids")
    void selectPageRoleListAndRoleIdsShouldWork() {
        SysRoleServiceImpl service = newService();
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleName("系统");
        bo.setRoleKey("system");
        bo.setStatus("0");
        bo.getParams().put("beginTime", "2026-03-01 00:00:00");
        bo.getParams().put("endTime", "2026-03-31 23:59:59");

        SysRoleVo vo = new SysRoleVo();
        vo.setRoleId(5L);
        Page<SysRoleVo> page = new Page<>();
        page.setRecords(List.of(vo));
        page.setTotal(1);
        when(sysRoleMapper.selectPageRoleList(any(), any())).thenReturn(page);
        when(sysRoleMapper.selectRolesByUserId(10L)).thenReturn(List.of(vo));

        TableDataInfo<SysRoleVo> result = service.selectPageRoleList(bo, new PageQuery(10, 1));
        List<Long> ids = service.selectRoleListByUserId(10L);

        assertEquals(1, result.getTotal());
        assertEquals(List.of(5L), ids);
    }

    @Test
    @DisplayName("checkRoleNameUnique/checkRoleKeyUnique: should reflect mapper exists")
    void checkRoleUniqueShouldReflectMapperExists() {
        SysRoleServiceImpl service = newService();
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(8L);
        bo.setRoleName("测试角色");
        bo.setRoleKey("tester");

        when(sysRoleMapper.exists(any())).thenReturn(true).thenReturn(false);

        assertFalse(service.checkRoleNameUnique(bo));
        assertTrue(service.checkRoleKeyUnique(bo));
    }

    @Test
    @DisplayName("checkRoleDataScope: should throw when part of roles out of scope")
    void checkRoleDataScopeShouldThrowWhenPartOutOfScope() {
        SysRoleServiceImpl service = newService();
        when(sysRoleMapper.selectRoleCount(List.of(1L, 2L))).thenReturn(1L);

        ServiceException ex;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::isSuperAdmin).thenReturn(false);
            ex = assertThrows(ServiceException.class, () -> service.checkRoleDataScope(List.of(1L, 2L)));
        }

        assertTrue(ex.getMessage().contains("没有权限访问部分角色数据"));
    }

    @Test
    @DisplayName("deleteRoleById: should clear role-menu/role-dept then delete role")
    void deleteRoleByIdShouldDeleteRelationsAndRole() {
        SysRoleServiceImpl service = newService();
        when(sysRoleMapper.deleteById(6L)).thenReturn(1);

        int rows = service.deleteRoleById(6L);

        assertEquals(1, rows);
        verify(sysRoleMenuMapper).delete(any());
        verify(sysRoleDeptMapper).delete(any());
    }

    @Test
    @DisplayName("deleteRoleByIds: should remove role relations then delete roles when unassigned")
    void deleteRoleByIdsShouldDeleteRelationsAndRolesWhenUnassigned() {
        SysRoleServiceImpl service = newService();
        SysRole role = new SysRole();
        role.setRoleId(9L);
        role.setRoleName("自定义角色");
        role.setRoleKey("custom_role");
        when(sysRoleMapper.selectRoleCount(List.of(9L))).thenReturn(1L);
        when(sysRoleMapper.selectByIds(List.of(9L))).thenReturn(List.of(role));
        when(sysRoleMapper.selectById(9L)).thenReturn(role);
        when(sysUserRoleMapper.selectList(any())).thenReturn(List.of());
        when(sysRoleMapper.deleteByIds(List.of(9L))).thenReturn(1);

        int rows;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::isSuperAdmin).thenReturn(false);
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(9L)).thenReturn(false);
            rows = service.deleteRoleByIds(List.of(9L));
        }

        assertEquals(1, rows);
        verify(sysRoleMenuMapper).delete(any());
        verify(sysRoleDeptMapper).delete(any());
    }

    @Test
    @DisplayName("deleteRoleByIds: should throw when any role has assigned user")
    void deleteRoleByIdsShouldThrowWhenRoleAssigned() {
        SysRoleServiceImpl service = newService();
        SysRole role = new SysRole();
        role.setRoleId(9L);
        role.setRoleName("自定义角色");
        role.setRoleKey("custom_role");
        SysUserRole userRole = new SysUserRole();
        userRole.setRoleId(9L);
        when(sysRoleMapper.selectRoleCount(List.of(9L))).thenReturn(1L);
        when(sysRoleMapper.selectByIds(List.of(9L))).thenReturn(List.of(role));
        when(sysRoleMapper.selectById(9L)).thenReturn(role);
        when(sysUserRoleMapper.selectList(any())).thenReturn(List.of(userRole));

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::isSuperAdmin).thenReturn(false);
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(9L)).thenReturn(false);

            ServiceException ex = assertThrows(ServiceException.class, () -> service.deleteRoleByIds(List.of(9L)));

            assertTrue(ex.getMessage().contains("自定义角色已分配"));
        }
    }

    @Test
    @DisplayName("selectRoleByIds: should delegate and return rows")
    void selectRoleByIdsShouldDelegateAndReturnRows() {
        SysRoleServiceImpl service = newService();
        SysRoleVo vo = new SysRoleVo();
        vo.setRoleId(6L);
        vo.setRoleName("运维");
        when(sysRoleMapper.selectRoleList(any())).thenReturn(List.of(vo));

        List<SysRoleVo> rows = service.selectRoleByIds(List.of(6L));

        assertEquals(1, rows.size());
        assertEquals(6L, rows.get(0).getRoleId());
    }

    @Test
    @DisplayName("selectRoleNamesByIds: should return empty map for empty input")
    void selectRoleNamesByIdsShouldReturnMappedResult() {
        SysRoleServiceImpl service = newService();
        assertEquals(Collections.emptyMap(), service.selectRoleNamesByIds(List.of()));
    }

    @Test
    @DisplayName("updateRoleStatus: should throw when disabling assigned role")
    void updateRoleStatusShouldThrowWhenDisablingAssignedRole() {
        SysRoleServiceImpl service = newService();
        when(sysUserRoleMapper.selectCount(any())).thenReturn(1L);

        ServiceException ex = assertThrows(ServiceException.class,
            () -> service.updateRoleStatus(7L, "1"));

        assertTrue(ex.getMessage().contains("角色已分配，不能禁用"));
    }

    @Test
    @DisplayName("insertRoleMenu(private): should insert menu relations and return inserted count")
    void insertRoleMenuShouldInsertMenuRelations() {
        SysRoleServiceImpl service = newService();
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(8L);
        bo.setMenuIds(new Long[]{10L, 11L});
        when(sysRoleMenuMapper.insertBatch(any())).thenReturn(true);

        int rows = invokePrivateIntMethod(service, "insertRoleMenu", bo);

        assertEquals(2, rows);
        verify(sysRoleMenuMapper).insertBatch(argThat(list -> list.size() == 2));
    }

    @Test
    @DisplayName("insertRoleMenu(private): should return one when menu ids empty")
    void insertRoleMenuShouldReturnOneWhenMenuIdsEmpty() {
        SysRoleServiceImpl service = newService();
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(8L);
        bo.setMenuIds(new Long[]{});

        int rows = invokePrivateIntMethod(service, "insertRoleMenu", bo);

        assertEquals(1, rows);
    }

    @Test
    @DisplayName("insertRoleDept(private): should insert dept relations and return inserted count")
    void insertRoleDeptShouldInsertDeptRelations() {
        SysRoleServiceImpl service = newService();
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(8L);
        bo.setDeptIds(new Long[]{20L, 21L});
        when(sysRoleDeptMapper.insertBatch(any())).thenReturn(true);

        int rows = invokePrivateIntMethod(service, "insertRoleDept", bo);

        assertEquals(2, rows);
        verify(sysRoleDeptMapper).insertBatch(argThat(list -> list.size() == 2));
    }

    @Test
    @DisplayName("insertRoleDept(private): should return one when dept ids empty")
    void insertRoleDeptShouldReturnOneWhenDeptIdsEmpty() {
        SysRoleServiceImpl service = newService();
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(8L);
        bo.setDeptIds(new Long[]{});

        int rows = invokePrivateIntMethod(service, "insertRoleDept", bo);

        assertEquals(1, rows);
    }

    @Test
    @DisplayName("deleteAuthUser: should throw when modifying current user role")
    void deleteAuthUserShouldThrowWhenModifyingCurrentUserRole() {
        SysRoleServiceImpl service = newService();
        SysUserRole userRole = new SysUserRole();
        userRole.setRoleId(2L);
        userRole.setUserId(88L);
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(88L);
            ServiceException ex = assertThrows(ServiceException.class, () -> service.deleteAuthUser(userRole));
            assertTrue(ex.getMessage().contains("不允许修改当前用户角色"));
        }
    }

    @Test
    @DisplayName("deleteAuthUsers: should delete and cleanup when rows > 0")
    void deleteAuthUsersShouldDeleteAndCleanup() {
        SysRoleServiceImpl service = spy(newService());
        doNothing().when(service).cleanOnlineUser(anyList());
        when(sysUserRoleMapper.delete(any())).thenReturn(2);
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(1L);
            int rows = service.deleteAuthUsers(9L, new Long[]{2L, 3L});
            assertEquals(2, rows);
            verify(service).cleanOnlineUser(List.of(2L, 3L));
        }
    }

    @Test
    @DisplayName("insertAuthUsers: should insert role users and cleanup online users")
    void insertAuthUsersShouldInsertAndCleanup() {
        SysRoleServiceImpl service = spy(newService());
        doNothing().when(service).cleanOnlineUser(anyList());
        when(sysUserRoleMapper.insertBatch(any())).thenReturn(true);
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(1L);
            int rows = service.insertAuthUsers(8L, new Long[]{2L, 3L});
            assertEquals(2, rows);
            verify(sysUserRoleMapper).insertBatch(argThat(list -> list.size() == 2));
            verify(service).cleanOnlineUser(List.of(2L, 3L));
        }
    }

    @Test
    @DisplayName("insertAuthUsers: should throw when includes current user")
    void insertAuthUsersShouldThrowWhenContainsCurrentUser() {
        SysRoleServiceImpl service = newService();
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(3L);
            ServiceException ex = assertThrows(ServiceException.class,
                () -> service.insertAuthUsers(8L, new Long[]{2L, 3L}));
            assertTrue(ex.getMessage().contains("不允许修改当前用户角色"));
        }
    }

    @Test
    @DisplayName("cleanOnlineUserByRole: should return immediately when role has no users")
    void cleanOnlineUserByRoleShouldReturnWhenNoUserBinding() {
        SysRoleServiceImpl service = newService();
        when(sysUserRoleMapper.selectCount(any())).thenReturn(0L);

        service.cleanOnlineUserByRole(6L);

        verify(sysUserRoleMapper, times(1)).selectCount(any());
        verify(securityTokenService, never()).revokeByRoleId(6L);
    }

    @Test
    @DisplayName("cleanOnlineUser: should return immediately when user id list is empty")
    void cleanOnlineUserShouldReturnWhenUserIdListIsEmpty() {
        SysRoleServiceImpl service = newService();

        service.cleanOnlineUser(List.of());

        verify(securityTokenService, never()).revokeByUserId(any());
    }

    @Test
    @DisplayName("cleanOnlineUserByRole: should revoke indexed tokens by role id")
    void cleanOnlineUserByRoleShouldRevokeByRoleId() {
        SysRoleServiceImpl service = newService();
        when(sysUserRoleMapper.selectCount(any())).thenReturn(1L);

        service.cleanOnlineUserByRole(6L);

        verify(securityTokenService).revokeByRoleId(6L);
    }

    @Test
    @DisplayName("cleanOnlineUser: should revoke each distinct non-null user id")
    void cleanOnlineUserShouldRevokeEachDistinctUserId() {
        SysRoleServiceImpl service = newService();

        service.cleanOnlineUser(Arrays.asList(100L, 200L, 100L, null));

        verify(securityTokenService, times(1)).revokeByUserId(100L);
        verify(securityTokenService, times(1)).revokeByUserId(200L);
        verify(securityTokenService, never()).revokeByUserId(null);
    }

    @Test
    @DisplayName("selectRoleById/selectRolesByUserId/checkRoleDataScope(Long): should delegate and validate")
    void selectRoleByIdAndRolesByUserIdAndCheckRoleDataScopeByLongShouldWork() {
        SysRoleServiceImpl service = newService();
        SysRoleVo vo = new SysRoleVo();
        vo.setRoleId(5L);
        vo.setRoleName("运营角色");
        when(sysRoleMapper.selectRoleById(5L)).thenReturn(vo);
        when(sysRoleMapper.selectRolesByUserId(99L)).thenReturn(List.of(vo));
        when(sysRoleMapper.selectRoleCount(List.of(5L))).thenReturn(1L);

        SysRoleVo byId = service.selectRoleById(5L);
        List<SysRoleVo> byUser = service.selectRolesByUserId(99L);
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::isSuperAdmin).thenReturn(false);
            service.checkRoleDataScope(5L);
            service.checkRoleDataScope((Long) null);
        }

        assertEquals("运营角色", byId.getRoleName());
        assertEquals(1, byUser.size());
        verify(sysRoleMapper).selectRoleCount(List.of(5L));
    }

    @Test
    @DisplayName("insertRole: should convert role, persist and insert role menus")
    void insertRoleShouldConvertPersistAndInsertRoleMenus() {
        SysRoleServiceImpl service = newService();
        SysRoleBo bo = new SysRoleBo();
        bo.setMenuIds(new Long[]{10L, 11L});
        SysRole role = new SysRole();
        role.setRoleId(66L);
        role.setRoleName("审计角色");
        when(sysRoleMapper.insert(role)).thenReturn(1);
        when(sysRoleMenuMapper.insertBatch(any())).thenReturn(true);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysRole.class)).thenReturn(role);

            int rows = service.insertRole(bo);

            assertEquals(2, rows);
            assertEquals(66L, bo.getRoleId());
            verify(sysRoleMapper).insert(role);
            verify(sysRoleMenuMapper).insertBatch(any());
        }
    }

    @Test
    @DisplayName("updateRole: should throw when disabling a role that has assigned users")
    void updateRoleShouldThrowWhenDisablingAssignedRole() {
        SysRoleServiceImpl service = newService();
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(66L);
        bo.setStatus(SystemConstants.DISABLE);
        bo.setMenuIds(new Long[]{10L});
        SysRole role = new SysRole();
        role.setRoleId(66L);
        role.setStatus(SystemConstants.DISABLE);
        when(sysUserRoleMapper.selectCount(any())).thenReturn(1L);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysRole.class)).thenReturn(role);

            assertThrows(ServiceException.class, () -> service.updateRole(bo));

            verify(sysRoleMapper, never()).updateById(any(SysRole.class));
        }
    }

    @Test
    @DisplayName("updateRole/authDataScope: should update role and rebuild related mappings")
    void updateRoleAndAuthDataScopeShouldUpdateRoleAndRebuildMappings() {
        SysRoleServiceImpl service = newService();
        SysRoleBo roleBo = new SysRoleBo();
        roleBo.setRoleId(66L);
        roleBo.setStatus(SystemConstants.NORMAL);
        roleBo.setMenuIds(new Long[]{10L, 11L});
        SysRole role = new SysRole();
        role.setRoleId(66L);
        role.setStatus(SystemConstants.NORMAL);
        when(sysRoleMapper.updateById(role)).thenReturn(1);
        when(sysRoleMenuMapper.insertBatch(any())).thenReturn(true);

        SysRoleBo dataScopeBo = new SysRoleBo();
        dataScopeBo.setRoleId(77L);
        dataScopeBo.setDeptIds(new Long[]{20L, 21L});
        SysRole dataScopeRole = new SysRole();
        dataScopeRole.setRoleId(77L);
        when(sysRoleMapper.updateById(dataScopeRole)).thenReturn(1);
        when(sysRoleDeptMapper.insertBatch(any())).thenReturn(true);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(roleBo, SysRole.class)).thenReturn(role);
            mapstructUtils.when(() -> MapstructUtils.convert(dataScopeBo, SysRole.class)).thenReturn(dataScopeRole);

            int updateRows = service.updateRole(roleBo);
            int scopeRows = service.authDataScope(dataScopeBo);

            assertEquals(2, updateRows);
            assertEquals(2, scopeRows);
            verify(sysRoleMenuMapper).delete(any());
            verify(sysRoleDeptMapper).delete(any());
            verify(sysRoleMenuMapper).insertBatch(any());
            verify(sysRoleDeptMapper).insertBatch(any());
        }
    }

    private SysRoleServiceImpl newService() {
        return new SysRoleServiceImpl(sysRoleMapper, sysRoleMenuMapper, sysUserRoleMapper, sysRoleDeptMapper, securityTokenService);
    }

    private static int invokePrivateIntMethod(SysRoleServiceImpl service, String methodName, SysRoleBo bo) {
        try {
            Method method = SysRoleServiceImpl.class.getDeclaredMethod(methodName, SysRoleBo.class);
            method.setAccessible(true);
            return (int) method.invoke(service, bo);
        } catch (InvocationTargetException ex) {
            Throwable cause = ex.getCause();
            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw new RuntimeException(cause);
        } catch (ReflectiveOperationException ex) {
            throw new RuntimeException(ex);
        }
    }
}
