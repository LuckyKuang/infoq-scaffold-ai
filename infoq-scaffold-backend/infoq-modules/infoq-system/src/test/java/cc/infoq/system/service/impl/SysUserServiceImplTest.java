package cc.infoq.system.service.impl;

import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.dto.UserDTO;
import cc.infoq.common.exception.ServiceException;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.utils.MapstructUtils;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.entity.SysUser;
import cc.infoq.system.domain.entity.SysUserPost;
import cc.infoq.system.domain.entity.SysUserRole;
import cc.infoq.system.domain.vo.*;
import cc.infoq.system.mapper.*;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.github.linpeilie.Converter;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
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
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysUserServiceImplTest {

    @Mock
    private SysUserMapper sysUserMapper;
    @Mock
    private SysDeptMapper sysDeptMapper;
    @Mock
    private SysRoleMapper sysRoleMapper;
    @Mock
    private SysPostMapper sysPostMapper;
    @Mock
    private SysUserRoleMapper sysUserRoleMapper;
    @Mock
    private SysUserPostMapper sysUserPostMapper;

    @BeforeEach
    void setUp() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> mock(Converter.class));
        context.refresh();
        new SpringUtils().setApplicationContext(context);
        if (TableInfoHelper.getTableInfo(SysUser.class) == null) {
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), SysUser.class);
        }
    }

    @Test
    @DisplayName("selectPageUserList: should build query and return page rows")
    void selectPageUserListShouldBuildQueryAndReturnRows() {
        SysUserServiceImpl service = newService();
        SysUserBo bo = new SysUserBo();
        bo.setUserId(8L);
        bo.setUserIds("8,9");
        bo.setUserName("admin");
        bo.setNickName("管理员");
        bo.setStatus(SystemConstants.NORMAL);
        bo.setPhonenumber("13800138000");
        bo.setDeptId(100L);
        bo.setExcludeUserIds("10,11");
        bo.getParams().put("beginTime", "2026-03-01 00:00:00");
        bo.getParams().put("endTime", "2026-03-31 23:59:59");
        when(sysDeptMapper.selectDeptAndChildById(100L)).thenReturn(List.of(100L, 101L));
        Page<SysUserVo> page = new Page<>(1, 10);
        page.setTotal(1);
        page.setRecords(List.of(userVo(8L, "admin", "管理员")));
        when(sysUserMapper.selectPageUserList(any(), any())).thenReturn(page);

        TableDataInfo<SysUserVo> table = service.selectPageUserList(bo, new PageQuery(1, 10));

        assertEquals(1L, table.getTotal());
        assertEquals(1, table.getRows().size());
        assertEquals("admin", table.getRows().get(0).getUserName());
        verify(sysDeptMapper).selectDeptAndChildById(100L);
    }

    @Test
    @DisplayName("selectAllocatedList/selectUnallocatedList: should return mapper page data")
    void selectAllocatedAndUnallocatedShouldReturnMapperPageData() {
        SysUserServiceImpl service = newService();
        SysUserBo bo = new SysUserBo();
        bo.setRoleId(2L);
        bo.setUserName("ops");
        bo.setStatus(SystemConstants.NORMAL);
        bo.setPhonenumber("139");
        Page<SysUserVo> allocatedPage = new Page<>(1, 10);
        allocatedPage.setTotal(1);
        allocatedPage.setRecords(List.of(userVo(12L, "ops", "运营")));
        when(sysUserMapper.selectAllocatedList(any(), any())).thenReturn(allocatedPage);

        Page<SysUserVo> unallocatedPage = new Page<>(1, 10);
        unallocatedPage.setTotal(1);
        unallocatedPage.setRecords(List.of(userVo(13L, "qa", "测试")));
        when(sysUserRoleMapper.selectUserIdsByRoleId(2L)).thenReturn(List.of(12L));
        when(sysUserMapper.selectUnallocatedList(any(), any())).thenReturn(unallocatedPage);

        TableDataInfo<SysUserVo> allocated = service.selectAllocatedList(bo, new PageQuery(1, 10));
        TableDataInfo<SysUserVo> unallocated = service.selectUnallocatedList(bo, new PageQuery(1, 10));

        assertEquals(1L, allocated.getTotal());
        assertEquals(1, allocated.getRows().size());
        assertEquals("ops", allocated.getRows().get(0).getUserName());
        assertEquals(1L, unallocated.getTotal());
        assertEquals(1, unallocated.getRows().size());
        assertEquals("qa", unallocated.getRows().get(0).getUserName());
        verify(sysUserRoleMapper).selectUserIdsByRoleId(2L);
    }

    @Test
    @DisplayName("selectListByIds: should return empty for empty ids")
    void selectListByIdsShouldReturnEmptyWhenIdsEmpty() {
        SysUserServiceImpl service = newService();

        List<UserDTO> list = service.selectListByIds(List.of());

        assertTrue(list.isEmpty());
    }

    @Test
    @DisplayName("selectUserIdsByRoleIds: should return empty for empty role ids")
    void selectUserIdsByRoleIdsShouldReturnEmptyWhenRoleIdsEmpty() {
        SysUserServiceImpl service = newService();

        List<Long> userIds = service.selectUserIdsByRoleIds(List.of());

        assertTrue(userIds.isEmpty());
    }

    @Test
    @DisplayName("selectUserIdsByRoleIds: should extract user ids from role relations")
    void selectUserIdsByRoleIdsShouldExtractUserIds() {
        SysUserServiceImpl service = newService();
        SysUserRole roleA = new SysUserRole();
        roleA.setRoleId(2L);
        roleA.setUserId(30L);
        SysUserRole roleB = new SysUserRole();
        roleB.setRoleId(3L);
        roleB.setUserId(31L);
        when(sysUserRoleMapper.selectList(any())).thenReturn(List.of(roleA, roleB));

        List<Long> userIds = service.selectUserIdsByRoleIds(List.of(2L, 3L));

        assertEquals(List.of(30L, 31L), userIds);
    }

    @Test
    @DisplayName("selectUsersByRoleIds/selectUsersByPostIds: should return empty for empty ids")
    void selectUsersByRoleIdsAndPostIdsShouldReturnEmptyWhenIdsEmpty() {
        SysUserServiceImpl service = newService();

        List<UserDTO> byRoles = service.selectUsersByRoleIds(List.of());
        List<UserDTO> byPosts = service.selectUsersByPostIds(List.of());

        assertTrue(byRoles.isEmpty());
        assertTrue(byPosts.isEmpty());
    }

    @Test
    @DisplayName("selectUsersByRoleIds/selectUsersByPostIds: should resolve user ids and delegate to selectListByIds")
    void selectUsersByRoleIdsAndPostIdsShouldResolveIdsAndDelegate() {
        SysUserServiceImpl service = spy(newService());
        SysUserRole roleA = new SysUserRole();
        roleA.setRoleId(2L);
        roleA.setUserId(100L);
        SysUserRole roleB = new SysUserRole();
        roleB.setRoleId(2L);
        roleB.setUserId(101L);
        SysUserPost postA = new SysUserPost();
        postA.setPostId(8L);
        postA.setUserId(200L);
        when(sysUserRoleMapper.selectList(any())).thenReturn(List.of(roleA, roleB));
        when(sysUserPostMapper.selectList(any())).thenReturn(List.of(postA));
        UserDTO dtoA = new UserDTO();
        dtoA.setUserId(100L);
        UserDTO dtoB = new UserDTO();
        dtoB.setUserId(200L);
        doReturn(List.of(dtoA)).when(service).selectListByIds(eq(List.of(100L, 101L)));
        doReturn(List.of(dtoB)).when(service).selectListByIds(eq(List.of(200L)));

        List<UserDTO> byRoles = service.selectUsersByRoleIds(List.of(2L));
        List<UserDTO> byPosts = service.selectUsersByPostIds(List.of(8L));

        assertEquals(1, byRoles.size());
        assertEquals(100L, byRoles.get(0).getUserId());
        assertEquals(1, byPosts.size());
        assertEquals(200L, byPosts.get(0).getUserId());
    }

    @Test
    @DisplayName("selectUserExportList: should support dept tree filtering and direct export")
    void selectUserExportListShouldSupportDeptTreeFilteringAndDirectExport() {
        SysUserServiceImpl service = newService();
        SysUserBo withDept = new SysUserBo();
        withDept.setDeptId(10L);
        SysUserBo withoutDept = new SysUserBo();
        SysUserExportVo withDeptVo = new SysUserExportVo();
        withDeptVo.setUserId(1L);
        withDeptVo.setUserName("alice");
        SysUserExportVo withoutDeptVo = new SysUserExportVo();
        withoutDeptVo.setUserId(2L);
        withoutDeptVo.setUserName("bob");
        when(sysDeptMapper.selectDeptAndChildById(10L)).thenReturn(List.of(10L, 11L));
        when(sysUserMapper.selectUserExportList(eq(withDept), eq(List.of(10L, 11L)), any()))
            .thenReturn(List.of(withDeptVo));
        when(sysUserMapper.selectUserExportList(eq(withoutDept), org.mockito.ArgumentMatchers.isNull(), any()))
            .thenReturn(List.of(withoutDeptVo));

        List<SysUserExportVo> exportWithDept = service.selectUserExportList(withDept);
        List<SysUserExportVo> exportWithoutDept = service.selectUserExportList(withoutDept);

        assertEquals("alice", exportWithDept.get(0).getUserName());
        assertEquals("bob", exportWithoutDept.get(0).getUserName());
        verify(sysDeptMapper).selectDeptAndChildById(10L);
    }

    @Test
    @DisplayName("selectNicknameByIds: should batch query nicknames and keep requested order")
    void selectNicknameByIdsShouldBatchQueryNicknamesAndKeepRequestedOrder() {
        SysUserServiceImpl service = spy(newService());
        SysUser userA = new SysUser();
        userA.setUserId(1L);
        userA.setNickName("Alice");
        SysUser userB = new SysUser();
        userB.setUserId(2L);
        userB.setNickName("");
        SysUser userC = new SysUser();
        userC.setUserId(3L);
        userC.setNickName("Bob");
        when(sysUserMapper.selectList(any())).thenReturn(List.of(userC, userB, userA));

        String result = service.selectNicknameByIds("1,2,3");

        assertEquals("Alice,Bob", result);
        verify(sysUserMapper).selectList(any());
        verify(service, never()).selectNicknameById(anyLong());
    }

    @Test
    @DisplayName("selectNicknameById/selectPhonenumberById/selectEmailById: should extract scalar fields")
    void selectScalarFieldsByIdShouldExtractValues() {
        SysUserServiceImpl service = newService();
        SysUser sysUser = new SysUser();
        sysUser.setNickName("测试昵称");
        sysUser.setPhonenumber("13800138000");
        sysUser.setEmail("demo@test.com");
        when(sysUserMapper.selectOne(any())).thenReturn(sysUser);

        String nickname = service.selectNicknameById(1L);
        String phonenumber = service.selectPhonenumberById(1L);
        String email = service.selectEmailById(1L);

        assertEquals("测试昵称", nickname);
        assertEquals("13800138000", phonenumber);
        assertEquals("demo@test.com", email);
    }

    @Test
    @DisplayName("updateUserAvatar/resetUserPwd: should delegate update wrapper and return mapper rows")
    void updateUserAvatarAndResetUserPwdShouldDelegateUpdateWrapper() {
        SysUserServiceImpl service = newService();
        when(sysUserMapper.update(eq(null), any())).thenReturn(1).thenReturn(0).thenReturn(2);

        boolean avatarUpdated = service.updateUserAvatar(9L, 88L);
        boolean avatarNotUpdated = service.updateUserAvatar(9L, 99L);
        int pwdRows = service.resetUserPwd(9L, "pwd");

        assertTrue(avatarUpdated);
        assertFalse(avatarNotUpdated);
        assertEquals(2, pwdRows);
    }

    @Test
    @DisplayName("selectUserByUserName: should fill dept name when deptName missing")
    void selectUserByUserNameShouldFillDeptName() {
        SysUserServiceImpl service = newService();
        SysUserVo userVo = userVo(5L, "ops", "运营");
        userVo.setDeptId(99L);
        userVo.setDeptName("");
        SysDeptVo deptVo = new SysDeptVo();
        deptVo.setDeptId(99L);
        deptVo.setDeptName("技术部");
        when(sysUserMapper.selectVoOne(any())).thenReturn(userVo);
        when(sysDeptMapper.selectVoById(99L)).thenReturn(deptVo);

        SysUserVo result = service.selectUserByUserName("ops");

        assertEquals("技术部", result.getDeptName());
        verify(sysDeptMapper).selectVoById(99L);
    }

    @Test
    @DisplayName("selectUserByPhonenumber: should fill dept name when deptName missing")
    void selectUserByPhonenumberShouldFillDeptName() {
        SysUserServiceImpl service = newService();
        SysUserVo userVo = userVo(6L, "ops2", "运营二");
        userVo.setDeptId(199L);
        userVo.setDeptName("");
        SysDeptVo deptVo = new SysDeptVo();
        deptVo.setDeptId(199L);
        deptVo.setDeptName("产品部");
        when(sysUserMapper.selectVoOne(any())).thenReturn(userVo);
        when(sysDeptMapper.selectVoById(199L)).thenReturn(deptVo);

        SysUserVo result = service.selectUserByPhonenumber("13800000000");

        assertEquals("产品部", result.getDeptName());
        verify(sysDeptMapper).selectVoById(199L);
    }

    @Test
    @DisplayName("selectUserById: should return null when mapper returns null")
    void selectUserByIdShouldReturnNullWhenMapperReturnsNull() {
        SysUserServiceImpl service = newService();
        when(sysUserMapper.selectVoById(8L)).thenReturn(null);

        assertNull(service.selectUserById(8L));
    }

    @Test
    @DisplayName("selectUserById: should attach roles when user exists")
    void selectUserByIdShouldAttachRolesWhenUserExists() {
        SysUserServiceImpl service = newService();
        SysUserVo userVo = userVo(8L, "alice", "爱丽丝");
        userVo.setDeptId(200L);
        SysDeptVo deptVo = new SysDeptVo();
        deptVo.setDeptId(200L);
        deptVo.setDeptName("研发中心");
        SysRoleVo roleVo = new SysRoleVo();
        roleVo.setRoleId(3L);
        roleVo.setRoleName("审计角色");
        when(sysUserMapper.selectVoById(8L)).thenReturn(userVo);
        when(sysDeptMapper.selectVoById(200L)).thenReturn(deptVo);
        when(sysRoleMapper.selectRolesByUserId(8L)).thenReturn(List.of(roleVo));

        SysUserVo result = service.selectUserById(8L);

        assertNotNull(result.getRoles());
        assertEquals(1, result.getRoles().size());
        assertEquals("审计角色", result.getRoles().get(0).getRoleName());
        assertEquals("研发中心", result.getDeptName());
    }

    @Test
    @DisplayName("selectUserByIds: should delegate with optional dept filter")
    void selectUserByIdsShouldDelegateWithOptionalDeptFilter() {
        SysUserServiceImpl service = newService();
        SysUserVo vo = userVo(11L, "u11", "用户11");
        when(sysUserMapper.selectUserList(any())).thenReturn(List.of(vo));

        List<SysUserVo> result = service.selectUserByIds(List.of(11L), 2L);

        assertEquals(1, result.size());
        assertEquals("u11", result.get(0).getUserName());
        verify(sysUserMapper).selectUserList(any());
    }

    @Test
    @DisplayName("updateUserStatus/updateUserProfile: should delegate update wrappers")
    void updateUserStatusAndProfileShouldDelegateUpdateWrappers() {
        SysUserServiceImpl service = newService();
        SysUserBo profile = new SysUserBo();
        profile.setUserId(99L);
        profile.setNickName("nick");
        profile.setPhonenumber("13800138001");
        profile.setEmail("nick@test.com");
        profile.setSex("0");
        when(sysUserMapper.update(eq(null), any())).thenReturn(1).thenReturn(2);

        int statusRows = service.updateUserStatus(99L, "1");
        int profileRows = service.updateUserProfile(profile);

        assertEquals(1, statusRows);
        assertEquals(2, profileRows);
    }

    @Test
    @DisplayName("selectUserNameById: should extract userName and handle null user")
    void selectUserNameByIdShouldExtractUserNameAndHandleNull() {
        SysUserServiceImpl service = newService();
        SysUser user = new SysUser();
        user.setUserName("alice");
        when(sysUserMapper.selectOne(any())).thenReturn(user).thenReturn(null);

        assertEquals("alice", service.selectUserNameById(7L));
        assertNull(service.selectUserNameById(8L));
    }

    @Test
    @DisplayName("selectUsersByDeptIds: should return empty when dept ids are empty")
    void selectUsersByDeptIdsShouldReturnEmptyWhenDeptIdsEmpty() {
        SysUserServiceImpl service = newService();

        List<UserDTO> result = service.selectUsersByDeptIds(List.of());

        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("checkUserNameUnique/checkPhoneUnique/checkEmailUnique: should reflect mapper exists")
    void checkUniqueShouldReflectMapperExists() {
        SysUserServiceImpl service = newService();
        SysUserBo bo = new SysUserBo();
        bo.setUserId(6L);
        bo.setUserName("unique_user");
        bo.setPhonenumber("13900009999");
        bo.setEmail("u@test.com");
        when(sysUserMapper.exists(any()))
            .thenReturn(true)
            .thenReturn(false)
            .thenReturn(true);

        assertFalse(service.checkUserNameUnique(bo));
        assertTrue(service.checkPhoneUnique(bo));
        assertFalse(service.checkEmailUnique(bo));
    }

    @Test
    @DisplayName("selectUserRoleGroup/selectUserPostGroup: should join names and return empty when no data")
    void selectUserRoleGroupAndPostGroupShouldJoinNames() {
        SysUserServiceImpl service = newService();
        SysRoleVo roleA = new SysRoleVo();
        roleA.setRoleName("管理员");
        SysRoleVo roleB = new SysRoleVo();
        roleB.setRoleName("审计员");
        SysPostVo postA = new SysPostVo();
        postA.setPostName("架构师");
        when(sysRoleMapper.selectRolesByUserId(10L)).thenReturn(List.of(roleA, roleB));
        when(sysPostMapper.selectPostsByUserId(10L)).thenReturn(List.of(postA));
        when(sysRoleMapper.selectRolesByUserId(11L)).thenReturn(List.of());
        when(sysPostMapper.selectPostsByUserId(11L)).thenReturn(List.of());

        assertEquals("管理员,审计员", service.selectUserRoleGroup(10L));
        assertEquals("架构师", service.selectUserPostGroup(10L));
        assertEquals("", service.selectUserRoleGroup(11L));
        assertEquals("", service.selectUserPostGroup(11L));
    }

    @Test
    @DisplayName("selectUserListByDept: should return mapper ordered list")
    void selectUserListByDeptShouldReturnMapperList() {
        SysUserServiceImpl service = newService();
        List<SysUserVo> expected = List.of(
            userVo(1L, "alice", "爱丽丝"),
            userVo(2L, "bob", "鲍勃")
        );
        when(sysUserMapper.selectVoList(any())).thenReturn(expected);

        List<SysUserVo> actual = service.selectUserListByDept(100L);

        assertEquals(2, actual.size());
        assertEquals("alice", actual.get(0).getUserName());
    }

    @Test
    @DisplayName("deleteUserById: should throw when delete count is zero")
    void deleteUserByIdShouldThrowWhenDeleteCountZero() {
        SysUserServiceImpl service = newService();
        when(sysUserMapper.deleteById(20L)).thenReturn(0);

        ServiceException ex = assertThrows(ServiceException.class, () -> service.deleteUserById(20L));

        assertTrue(ex.getMessage().contains("删除用户失败"));
        verify(sysUserRoleMapper).delete(any());
        verify(sysUserPostMapper).delete(any());
    }

    @Test
    @DisplayName("deleteUserById: should delete role/post relations then user record")
    void deleteUserByIdShouldDeleteRelationsThenUser() {
        SysUserServiceImpl service = newService();
        when(sysUserMapper.deleteById(20L)).thenReturn(1);

        int rows = service.deleteUserById(20L);

        assertEquals(1, rows);
        verify(sysUserRoleMapper).delete(any());
        verify(sysUserPostMapper).delete(any());
        verify(sysUserMapper).deleteById(20L);
    }

    @Test
    @DisplayName("insertUserAuth: should clear old roles, filter super-admin role and insert")
    void insertUserAuthShouldFilterSuperAdminRoleAndInsert() {
        SysUserServiceImpl service = newService();
        when(sysRoleMapper.selectRoleCount(List.of(2L))).thenReturn(1L);
        when(sysUserRoleMapper.insertBatch(any())).thenReturn(true);

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(2L)).thenReturn(false);
            service.insertUserAuth(2L, new Long[]{SystemConstants.SUPER_ADMIN_ID, 2L});
        }

        verify(sysUserRoleMapper).delete(any());
        verify(sysUserRoleMapper).insertBatch(argThat(list -> {
            SysUserRole inserted = list.iterator().next();
            return list.size() == 1
                && inserted.getRoleId().equals(2L)
                && inserted.getUserId().equals(2L);
        }));
    }

    @Test
    @DisplayName("insertUserAuth: should throw when role is out of data scope")
    void insertUserAuthShouldThrowWhenRoleOutOfScope() {
        SysUserServiceImpl service = newService();
        when(sysRoleMapper.selectRoleCount(List.of(2L, 3L))).thenReturn(1L);

        ServiceException ex;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(100L)).thenReturn(false);
            ex = assertThrows(ServiceException.class,
                () -> service.insertUserAuth(100L, new Long[]{2L, 3L}));
        }

        assertTrue(ex.getMessage().contains("没有权限访问角色的数据"));
    }

    @Test
    @DisplayName("insertUserPost(private): should clear old posts and insert post relations")
    void insertUserPostShouldClearAndInsertRelations() {
        SysUserServiceImpl service = newService();
        SysUserBo bo = new SysUserBo();
        bo.setUserId(30L);
        bo.setPostIds(new Long[]{100L, 101L});
        when(sysPostMapper.selectPostCount(List.of(100L, 101L))).thenReturn(2L);
        when(sysUserPostMapper.insertBatch(any())).thenReturn(true);

        invokePrivateInsertUserPost(service, bo, true);

        verify(sysUserPostMapper).delete(any());
        verify(sysUserPostMapper).insertBatch(argThat(list -> {
            SysUserPost first = list.iterator().next();
            SysUserPost second = list.stream().skip(1).findFirst().orElseThrow();
            return list.size() == 2
                && Set.of(first.getPostId(), second.getPostId()).equals(Set.of(100L, 101L));
        }));
    }

    @Test
    @DisplayName("insertUserPost(private): should throw when post is out of data scope")
    void insertUserPostShouldThrowWhenPostOutOfScope() {
        SysUserServiceImpl service = newService();
        SysUserBo bo = new SysUserBo();
        bo.setUserId(30L);
        bo.setPostIds(new Long[]{100L, 101L});
        when(sysPostMapper.selectPostCount(List.of(100L, 101L))).thenReturn(1L);

        ServiceException ex = assertThrows(ServiceException.class,
            () -> invokePrivateInsertUserPost(service, bo, false));

        assertTrue(ex.getMessage().contains("没有权限访问岗位的数据"));
    }

    @Test
    @DisplayName("deleteUserByIds: should throw when super admin included")
    void deleteUserByIdsShouldThrowWhenSuperAdminIncluded() {
        SysUserServiceImpl service = newService();

        ServiceException ex;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(1L)).thenReturn(true);
            ex = assertThrows(ServiceException.class, () -> service.deleteUserByIds(new Long[]{1L}));
        }

        assertTrue(ex.getMessage().contains("不允许操作超级管理员用户"));
    }

    @Test
    @DisplayName("deleteUserByIds: should throw when current operator has no data scope")
    void deleteUserByIdsShouldThrowWhenNoDataScope() {
        SysUserServiceImpl service = newService();
        when(sysUserMapper.selectUserList(any())).thenReturn(List.of());

        ServiceException ex;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(2L)).thenReturn(false);
            loginHelper.when(LoginUserContext::isSuperAdmin).thenReturn(false);
            ex = assertThrows(ServiceException.class, () -> service.deleteUserByIds(new Long[]{2L}));
        }

        assertTrue(ex.getMessage().contains("没有权限访问用户数据"));
    }

    @Test
    @DisplayName("deleteUserByIds: should throw when delete count is zero")
    void deleteUserByIdsShouldThrowWhenDeleteCountZero() {
        SysUserServiceImpl service = newService();
        when(sysUserMapper.selectUserList(any())).thenReturn(List.of(
            userVo(2L, "u2", "用户2"),
            userVo(3L, "u3", "用户3")
        ));
        when(sysUserMapper.deleteByIds(any())).thenReturn(0);

        ServiceException ex;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::isSuperAdmin).thenReturn(false);
            ex = assertThrows(ServiceException.class, () -> service.deleteUserByIds(new Long[]{2L, 3L}));
        }

        assertTrue(ex.getMessage().contains("删除用户失败"));
    }

    @Test
    @DisplayName("deleteUserByIds: should delete role/post relations then user records")
    void deleteUserByIdsShouldDeleteRelationsThenUsers() {
        SysUserServiceImpl service = newService();
        when(sysUserMapper.selectUserList(any())).thenReturn(List.of(
            userVo(2L, "u2", "用户2"),
            userVo(3L, "u3", "用户3")
        ));
        when(sysUserMapper.deleteByIds(any())).thenReturn(2);

        int rows;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::isSuperAdmin).thenReturn(false);
            rows = service.deleteUserByIds(new Long[]{2L, 3L});
        }

        assertEquals(2, rows);
        verify(sysUserRoleMapper).delete(any());
        verify(sysUserPostMapper).delete(any());
        verify(sysUserMapper).deleteByIds(eq(List.of(2L, 3L)));
    }

    @Test
    @DisplayName("selectUserNamesByIds: should return empty map for empty ids")
    void selectUserNamesByIdsShouldReturnEmptyMap() {
        SysUserServiceImpl service = newService();

        Map<Long, String> map = service.selectUserNamesByIds(List.of());

        assertTrue(map.isEmpty());
        assertEquals(Map.of(), map);
    }

    @Test
    @DisplayName("insertUser: should convert user, persist and create role/post relations")
    void insertUserShouldConvertPersistAndCreateRelations() {
        SysUserServiceImpl service = newService();
        SysUserBo bo = new SysUserBo();
        bo.setUserName("alice");
        bo.setRoleIds(new Long[]{2L});
        bo.setPostIds(new Long[]{3L});
        SysUser converted = new SysUser();
        converted.setUserId(88L);
        converted.setUserName("alice");
        when(sysUserMapper.insert(converted)).thenReturn(1);
        when(sysRoleMapper.selectRoleCount(List.of(2L))).thenReturn(1L);
        when(sysPostMapper.selectPostCount(List.of(3L))).thenReturn(1L);
        when(sysUserRoleMapper.insertBatch(any())).thenReturn(true);
        when(sysUserPostMapper.insertBatch(any())).thenReturn(true);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class);
             MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(bo, SysUser.class)).thenReturn(converted);
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(88L)).thenReturn(false);

            int rows = service.insertUser(bo);

            assertEquals(1, rows);
            assertEquals(88L, bo.getUserId());
            verify(sysUserMapper).insert(converted);
            verify(sysUserRoleMapper).insertBatch(argThat(list -> {
                SysUserRole inserted = list.iterator().next();
                return list.size() == 1
                    && inserted.getRoleId().equals(2L)
                    && inserted.getUserId().equals(88L);
            }));
            verify(sysUserPostMapper).insertBatch(argThat(list -> {
                SysUserPost inserted = list.iterator().next();
                return list.size() == 1
                    && inserted.getPostId().equals(3L)
                    && inserted.getUserId().equals(88L);
            }));
        }
    }

    @Test
    @DisplayName("registerUser: should set audit fields and return mapper insert result")
    void registerUserShouldSetAuditFieldsAndReturnInsertResult() {
        SysUserServiceImpl service = newService();
        SysUserBo successBo = new SysUserBo();
        successBo.setUserName("register-a");
        SysUserBo failBo = new SysUserBo();
        failBo.setUserName("register-b");
        SysUser successEntity = new SysUser();
        SysUser failEntity = new SysUser();
        when(sysUserMapper.insert(any(SysUser.class))).thenReturn(1).thenReturn(0);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(successBo, SysUser.class)).thenReturn(successEntity);
            mapstructUtils.when(() -> MapstructUtils.convert(failBo, SysUser.class)).thenReturn(failEntity);

            boolean success = service.registerUser(successBo);
            boolean fail = service.registerUser(failBo);

            assertTrue(success);
            assertFalse(fail);
            assertEquals(0L, successBo.getCreateBy());
            assertEquals(0L, successBo.getUpdateBy());
            assertEquals(0L, failBo.getCreateBy());
            assertEquals(0L, failBo.getUpdateBy());
        }
    }

    @Test
    @DisplayName("updateUser: should rebuild relations, update user and throw when update fails")
    void updateUserShouldRebuildRelationsAndThrowWhenUpdateFails() {
        SysUserServiceImpl service = newService();
        SysUserBo successBo = new SysUserBo();
        successBo.setUserId(50L);
        successBo.setUserName("u-success");
        successBo.setRoleIds(new Long[]{2L});
        successBo.setPostIds(new Long[]{3L});
        SysUser successUser = new SysUser();
        successUser.setUserId(50L);

        SysUserBo failBo = new SysUserBo();
        failBo.setUserId(51L);
        failBo.setUserName("u-fail");
        failBo.setRoleIds(new Long[]{2L});
        failBo.setPostIds(new Long[]{3L});
        SysUser failUser = new SysUser();
        failUser.setUserId(51L);

        when(sysRoleMapper.selectRoleCount(List.of(2L))).thenReturn(1L);
        when(sysPostMapper.selectPostCount(List.of(3L))).thenReturn(1L);
        when(sysUserRoleMapper.insertBatch(any())).thenReturn(true);
        when(sysUserPostMapper.insertBatch(any())).thenReturn(true);
        when(sysUserMapper.updateById(successUser)).thenReturn(1);
        when(sysUserMapper.updateById(failUser)).thenReturn(0);

        try (MockedStatic<MapstructUtils> mapstructUtils = mockStatic(MapstructUtils.class);
             MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            mapstructUtils.when(() -> MapstructUtils.convert(successBo, SysUser.class)).thenReturn(successUser);
            mapstructUtils.when(() -> MapstructUtils.convert(failBo, SysUser.class)).thenReturn(failUser);
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(50L)).thenReturn(false);
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(51L)).thenReturn(false);

            int rows = service.updateUser(successBo);
            ServiceException ex = assertThrows(ServiceException.class, () -> service.updateUser(failBo));

            assertEquals(1, rows);
            assertTrue(ex.getMessage().contains("修改用户"));
            verify(sysUserRoleMapper, org.mockito.Mockito.times(2)).delete(any());
            verify(sysUserPostMapper, org.mockito.Mockito.times(2)).delete(any());
            verify(sysUserMapper).updateById(successUser);
            verify(sysUserMapper).updateById(failUser);
        }
    }

    private static void invokePrivateInsertUserPost(SysUserServiceImpl service, SysUserBo bo, boolean clear) {
        try {
            Method method = SysUserServiceImpl.class.getDeclaredMethod("insertUserPost", SysUserBo.class, boolean.class);
            method.setAccessible(true);
            method.invoke(service, bo, clear);
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

    private SysUserServiceImpl newService() {
        return new SysUserServiceImpl(
            sysUserMapper,
            sysDeptMapper,
            sysRoleMapper,
            sysPostMapper,
            sysUserRoleMapper,
            sysUserPostMapper
        );
    }

    private static SysUserVo userVo(Long userId, String userName, String nickName) {
        SysUserVo vo = new SysUserVo();
        vo.setUserId(userId);
        vo.setUserName(userName);
        vo.setNickName(nickName);
        vo.setStatus(SystemConstants.NORMAL);
        return vo;
    }
}
