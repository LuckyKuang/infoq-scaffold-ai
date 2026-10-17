package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.domain.model.LoginUser;
import cc.infoq.common.excel.core.ExcelResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.vo.*;
import cc.infoq.system.listener.SysUserImportListener;
import cc.infoq.system.service.*;
import cn.hutool.core.lang.tree.Tree;
import cn.hutool.crypto.digest.BCrypt;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysUserControllerTest {

    @Mock
    private SysUserService sysUserService;
    @Mock
    private SysRoleService sysRoleService;
    @Mock
    private SysPostService sysPostService;
    @Mock
    private SysDeptService sysDeptService;
    @Mock
    private ExcelResult<SysUserImportVo> excelResult;

    @InjectMocks
    private SysUserController controller;

    @Test
    @DisplayName("remove: should fail when current user is included")
    void removeShouldFailWhenContainsCurrentUser() {
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(1L);

            ApiResult<Void> result = controller.remove(new Long[]{1L, 2L});

            assertEquals(ApiResult.FAIL, result.getCode());
            assertTrue(result.getMsg().contains("当前用户不能删除"));
            verifyNoInteractions(sysUserService);
        }
    }

    @Test
    @DisplayName("getInfo(userId): should assemble user detail including roles and posts")
    void getInfoByUserIdShouldAssembleUserDetail() {
        Long userId = 11L;
        SysUserVo user = new SysUserVo();
        user.setUserId(userId);
        user.setDeptId(2L);
        user.setUserName("demo");
        when(sysUserService.selectUserById(userId)).thenReturn(user);
        when(sysRoleService.selectRoleListByUserId(userId)).thenReturn(List.of(2L));

        SysPostVo post = new SysPostVo();
        post.setPostId(9L);
        when(sysPostService.selectPostList(org.mockito.ArgumentMatchers.any())).thenReturn(List.of(post));
        when(sysPostService.selectPostListByUserId(userId)).thenReturn(List.of(9L));

        SysRoleVo superAdminRole = new SysRoleVo();
        superAdminRole.setRoleId(1L);
        SysRoleVo normalRole = new SysRoleVo();
        normalRole.setRoleId(2L);
        when(sysRoleService.selectRoleList(org.mockito.ArgumentMatchers.any())).thenReturn(List.of(superAdminRole, normalRole));

        ApiResult<SysUserInfoVo> result;
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(userId)).thenReturn(false);
            result = controller.getInfo(userId);
        }

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertNotNull(result.getData());
        assertEquals(userId, result.getData().getUser().getUserId());
        assertEquals(List.of(2L), result.getData().getRoleIds());
        assertEquals(List.of(9L), result.getData().getPostIds());
        assertEquals(1, result.getData().getRoles().size());
        assertEquals(2L, result.getData().getRoles().get(0).getRoleId());
        verify(sysUserService).checkUserDataScope(userId);
    }

    @Test
    @DisplayName("add: should fail when phone number already exists")
    void addShouldFailWhenPhoneExists() {
        SysUserBo bo = new SysUserBo();
        bo.setDeptId(2L);
        bo.setUserName("new-user");
        bo.setPassword("123456");
        bo.setPhonenumber("13800000000");

        when(sysUserService.checkUserNameUnique(bo)).thenReturn(true);
        when(sysUserService.checkPhoneUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("手机号码已存在"));
        verifyNoInteractions(sysRoleService, sysPostService);
    }

    @Test
    @DisplayName("edit: should return success when all uniqueness checks pass")
    void editShouldReturnSuccessWhenAllChecksPass() {
        SysUserBo bo = new SysUserBo();
        bo.setUserId(20L);
        bo.setDeptId(3L);
        bo.setUserName("editor");
        bo.setPhonenumber("13900000000");
        bo.setEmail("editor@test.com");

        when(sysUserService.checkUserNameUnique(bo)).thenReturn(true);
        when(sysUserService.checkPhoneUnique(bo)).thenReturn(true);
        when(sysUserService.checkEmailUnique(bo)).thenReturn(true);
        when(sysUserService.updateUser(bo)).thenReturn(1);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysUserService).checkUserAllowed(20L);
        verify(sysUserService).checkUserDataScope(20L);
        verify(sysDeptService).checkDeptDataScope(3L);
    }

    @Test
    @DisplayName("getInfo(): should fail when login user has no accessible profile")
    void getInfoShouldFailWhenNoAccessibleUserData() {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(30L);
        loginUser.setMenuPermission(Set.of("system:user:list"));
        loginUser.setRolePermission(Set.of("admin"));

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getLoginUser).thenReturn(loginUser);
            when(sysUserService.selectUserById(30L)).thenReturn(null);

            ApiResult<UserInfoVo> result = controller.getInfo();

            assertEquals(ApiResult.FAIL, result.getCode());
            assertTrue(result.getMsg().contains("没有权限访问用户数据"));
        }
    }

    @Test
    @DisplayName("getInfo(): should return user detail with permissions and roles")
    void getInfoShouldReturnUserPermissionsAndRoles() {
        LoginUser loginUser = new LoginUser();
        loginUser.setUserId(31L);
        loginUser.setMenuPermission(Set.of("system:user:list", "system:user:edit"));
        loginUser.setRolePermission(Set.of("admin"));
        SysUserVo userVo = new SysUserVo();
        userVo.setUserId(31L);
        userVo.setUserName("tester");

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getLoginUser).thenReturn(loginUser);
            when(sysUserService.selectUserById(31L)).thenReturn(userVo);

            ApiResult<UserInfoVo> result = controller.getInfo();

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertNotNull(result.getData());
            assertEquals(31L, result.getData().getUser().getUserId());
            assertEquals(Set.of("system:user:list", "system:user:edit"), result.getData().getPermissions());
            assertEquals(Set.of("admin"), result.getData().getRoles());
        }
    }

    @Test
    @DisplayName("authRole: should filter super-admin role for non-super-admin user")
    void authRoleShouldFilterSuperAdminRoleForNormalUser() {
        Long userId = 45L;
        SysUserVo userVo = new SysUserVo();
        userVo.setUserId(userId);
        SysRoleVo superAdmin = new SysRoleVo();
        superAdmin.setRoleId(1L);
        SysRoleVo normalRole = new SysRoleVo();
        normalRole.setRoleId(3L);
        when(sysUserService.selectUserById(userId)).thenReturn(userVo);
        when(sysRoleService.selectRolesAuthByUserId(userId)).thenReturn(List.of(superAdmin, normalRole));

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(userId)).thenReturn(false);

            ApiResult<SysUserInfoVo> result = controller.authRole(userId);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertEquals(userId, result.getData().getUser().getUserId());
            assertEquals(1, result.getData().getRoles().size());
            assertEquals(3L, result.getData().getRoles().get(0).getRoleId());
            verify(sysUserService).checkUserDataScope(userId);
        }
    }

    @Test
    @DisplayName("resetPwd: should hash password before delegating to service")
    void resetPwdShouldHashPasswordBeforeDelegation() {
        SysUserBo bo = new SysUserBo();
        bo.setUserId(56L);
        bo.setPassword("origin-password");
        when(sysUserService.resetUserPwd(eq(56L), any())).thenReturn(1);

        ApiResult<Void> result = controller.resetPwd(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        ArgumentCaptor<String> passwordCaptor = ArgumentCaptor.forClass(String.class);
        verify(sysUserService).resetUserPwd(eq(56L), passwordCaptor.capture());
        assertTrue(BCrypt.checkpw("origin-password", passwordCaptor.getValue()));
    }

    @Test
    @DisplayName("changeStatus: should return success and delegate status update")
    void changeStatusShouldReturnSuccess() {
        SysUserBo bo = new SysUserBo();
        bo.setUserId(57L);
        bo.setStatus("0");
        when(sysUserService.updateUserStatus(57L, "0")).thenReturn(1);

        ApiResult<Void> result = controller.changeStatus(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysUserService).checkUserAllowed(57L);
        verify(sysUserService).checkUserDataScope(57L);
    }

    @Test
    @DisplayName("optionselect: should pass null ids when input array is empty")
    void optionselectShouldPassNullWhenIdsEmpty() {
        SysUserVo userVo = new SysUserVo();
        userVo.setUserId(1L);
        when(sysUserService.selectUserByIds(null, 8L)).thenReturn(List.of(userVo));

        ApiResult<List<SysUserVo>> result = controller.optionselect(new Long[]{}, 8L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(1, result.getData().size());
    }

    @Test
    @DisplayName("optionselect: should pass id list when ids provided")
    void optionselectShouldPassIdsWhenProvided() {
        SysUserVo userVo = new SysUserVo();
        userVo.setUserId(2L);
        when(sysUserService.selectUserByIds(List.of(2L), null)).thenReturn(List.of(userVo));

        ApiResult<List<SysUserVo>> result = controller.optionselect(new Long[]{2L}, null);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(2L, result.getData().get(0).getUserId());
    }

    @Test
    @DisplayName("insertAuthRole: should check user scope and save role relation")
    void insertAuthRoleShouldDelegate() {
        Long[] roleIds = new Long[]{5L, 6L};

        ApiResult<Void> result = controller.insertAuthRole(66L, roleIds);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysUserService).checkUserDataScope(66L);
        verify(sysUserService).insertUserAuth(66L, roleIds);
    }

    @Test
    @DisplayName("list/deptTree/listByDept: should delegate to corresponding services")
    void listAndDeptMethodsShouldDelegate() {
        SysUserBo userBo = new SysUserBo();
        PageQuery pageQuery = new PageQuery(10, 1);
        TableDataInfo<SysUserVo> table = TableDataInfo.build(List.of(new SysUserVo()));
        when(sysUserService.selectPageUserList(userBo, pageQuery)).thenReturn(table);
        when(sysDeptService.selectDeptTreeList(org.mockito.ArgumentMatchers.any())).thenReturn(List.<Tree<Long>>of());
        when(sysUserService.selectUserListByDept(9L)).thenReturn(List.of(new SysUserVo()));

        TableDataInfo<SysUserVo> listResult = controller.list(userBo, pageQuery);
        ApiResult<List<Tree<Long>>> treeResult = controller.deptTree(null);
        ApiResult<List<SysUserVo>> byDeptResult = controller.listByDept(9L);

        assertEquals(1, listResult.getRows().size());
        assertEquals(ApiResult.SUCCESS, treeResult.getCode());
        assertEquals(ApiResult.SUCCESS, byDeptResult.getCode());
        assertEquals(1, byDeptResult.getData().size());
    }

    @Test
    @DisplayName("export: should query rows and invoke excel util")
    void exportShouldQueryRowsAndInvokeExcelUtil() {
        SysUserBo bo = new SysUserBo();
        List<SysUserExportVo> rows = List.of(new SysUserExportVo());
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);
        when(sysUserService.selectUserExportList(bo)).thenReturn(rows);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class)) {
            controller.export(bo, response);
            excelUtil.verify(() -> ExcelUtil.exportExcel(rows, "用户数据", SysUserExportVo.class, response));
        }
    }

    @Test
    @DisplayName("importTemplate: should export empty import template via excel util")
    void importTemplateShouldExportEmptyTemplate() {
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class)) {
            controller.importTemplate(response);

            excelUtil.verify(() -> ExcelUtil.exportExcel(anyList(), eq("用户数据"), eq(SysUserImportVo.class), eq(response)));
        }
    }

    @Test
    @DisplayName("importData: should import excel and return analysis message")
    void importDataShouldImportExcelAndReturnAnalysisMessage() throws Exception {
        MultipartFile file = org.mockito.Mockito.mock(MultipartFile.class);
        when(file.getInputStream()).thenReturn(new java.io.ByteArrayInputStream(new byte[]{1, 2, 3}));
        when(excelResult.getAnalysis()).thenReturn("导入完成");
        SysConfigService configService = org.mockito.Mockito.mock(SysConfigService.class);
        when(configService.selectConfigByKey("sys.user.initPassword")).thenReturn("123456");

        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(SysConfigService.class, () -> configService);
        context.registerBean(SysUserService.class, () -> sysUserService);
        context.registerBean(Validator.class, () -> Validation.buildDefaultValidatorFactory().getValidator());
        context.refresh();
        new cc.infoq.common.utils.SpringUtils().setApplicationContext(context);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class);
             MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(1L);
            excelUtil.when(() -> ExcelUtil.importExcel(any(java.io.InputStream.class), eq(SysUserImportVo.class), any(SysUserImportListener.class)))
                .thenReturn(excelResult);

            ApiResult<Void> result = controller.importData(file, true);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertEquals("导入完成", result.getMsg());
        }
    }
}
