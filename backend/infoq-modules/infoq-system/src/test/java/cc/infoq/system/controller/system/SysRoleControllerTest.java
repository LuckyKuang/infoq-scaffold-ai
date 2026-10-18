package cc.infoq.system.controller.system;

import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.excel.utils.ExcelUtil;
import cc.infoq.common.mybatis.core.page.PageQuery;
import cc.infoq.common.mybatis.core.page.TableDataInfo;
import cc.infoq.system.domain.bo.SysRoleBo;
import cc.infoq.system.domain.bo.SysUserBo;
import cc.infoq.system.domain.entity.SysUserRole;
import cc.infoq.system.domain.vo.SysRoleVo;
import cc.infoq.system.domain.vo.SysUserVo;
import cc.infoq.system.service.SysDeptService;
import cc.infoq.system.service.SysRoleService;
import cc.infoq.system.service.SysUserService;
import cn.hutool.core.lang.tree.Tree;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysRoleControllerTest {

    @Mock
    private SysRoleService sysRoleService;
    @Mock
    private SysUserService sysUserService;
    @Mock
    private SysDeptService sysDeptService;

    @InjectMocks
    private SysRoleController controller;

    @Test
    @DisplayName("add: should fail when role name already exists")
    void addShouldFailWhenRoleNameExists() {
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleName("管理员");
        doNothing().when(sysRoleService).checkRoleAllowed(bo);
        when(sysRoleService.checkRoleNameUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("角色名称已存在"));
    }

    @Test
    @DisplayName("edit: should return success and clean online users when update succeeds")
    void editShouldReturnSuccessWhenUpdateSucceeds() {
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(2L);
        bo.setRoleName("财务");
        doNothing().when(sysRoleService).checkRoleAllowed(bo);
        doNothing().when(sysRoleService).checkRoleDataScope(2L);
        when(sysRoleService.checkRoleNameUnique(bo)).thenReturn(true);
        when(sysRoleService.checkRoleKeyUnique(bo)).thenReturn(true);
        when(sysRoleService.updateRole(bo)).thenReturn(1);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysRoleService).cleanOnlineUserByRole(2L);
    }

    @Test
    @DisplayName("edit: should fail when role key already exists")
    void editShouldFailWhenRoleKeyExists() {
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(3L);
        bo.setRoleName("运营");
        doNothing().when(sysRoleService).checkRoleAllowed(bo);
        doNothing().when(sysRoleService).checkRoleDataScope(3L);
        when(sysRoleService.checkRoleNameUnique(bo)).thenReturn(true);
        when(sysRoleService.checkRoleKeyUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("角色权限已存在"));
    }

    @Test
    @DisplayName("edit: should fail when update rows is zero")
    void editShouldFailWhenUpdateRowsIsZero() {
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(4L);
        bo.setRoleName("人事");
        doNothing().when(sysRoleService).checkRoleAllowed(bo);
        doNothing().when(sysRoleService).checkRoleDataScope(4L);
        when(sysRoleService.checkRoleNameUnique(bo)).thenReturn(true);
        when(sysRoleService.checkRoleKeyUnique(bo)).thenReturn(true);
        when(sysRoleService.updateRole(bo)).thenReturn(0);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("失败，请联系管理员"));
    }

    @Test
    @DisplayName("dataScope: should return success when authDataScope affected rows")
    void dataScopeShouldReturnSuccessWhenUpdated() {
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(9L);
        doNothing().when(sysRoleService).checkRoleAllowed(bo);
        doNothing().when(sysRoleService).checkRoleDataScope(9L);
        when(sysRoleService.authDataScope(bo)).thenReturn(1);

        ApiResult<Void> result = controller.dataScope(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("changeStatus: should return success when update role status succeeds")
    void changeStatusShouldReturnSuccessWhenUpdated() {
        SysRoleBo bo = new SysRoleBo();
        bo.setRoleId(10L);
        bo.setStatus("0");
        doNothing().when(sysRoleService).checkRoleAllowed(bo);
        doNothing().when(sysRoleService).checkRoleDataScope(10L);
        when(sysRoleService.updateRoleStatus(10L, "0")).thenReturn(1);

        ApiResult<Void> result = controller.changeStatus(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
    }

    @Test
    @DisplayName("optionselect: should delegate list query with null roleIds")
    void optionselectShouldDelegateWithNullRoleIds() {
        SysRoleVo roleVo = new SysRoleVo();
        roleVo.setRoleId(1L);
        when(sysRoleService.selectRoleByIds(null)).thenReturn(List.of(roleVo));

        ApiResult<List<SysRoleVo>> result = controller.optionselect(null);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertNotNull(result.getData());
        assertEquals(1, result.getData().size());
    }

    @Test
    @DisplayName("getInfo: should check data scope and return role detail")
    void getInfoShouldCheckDataScopeAndReturnRole() {
        SysRoleVo roleVo = new SysRoleVo();
        roleVo.setRoleId(20L);
        doNothing().when(sysRoleService).checkRoleDataScope(20L);
        when(sysRoleService.selectRoleById(20L)).thenReturn(roleVo);

        ApiResult<SysRoleVo> result = controller.getInfo(20L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(20L, result.getData().getRoleId());
    }

    @Test
    @DisplayName("remove/cancel/select auth methods: should delegate to role service")
    void authAndRemoveMethodsShouldDelegateToRoleService() {
        Long[] roleIds = new Long[]{1L, 2L};
        Long[] userIds = new Long[]{9L, 10L};
        when(sysRoleService.deleteRoleByIds(List.of(1L, 2L))).thenReturn(1);
        SysUserRole userRole = new SysUserRole();
        when(sysRoleService.deleteAuthUser(userRole)).thenReturn(1);
        when(sysRoleService.deleteAuthUsers(1L, userIds)).thenReturn(2);
        when(sysRoleService.insertAuthUsers(1L, userIds)).thenReturn(2);

        ApiResult<Void> removeResult = controller.remove(roleIds);
        ApiResult<Void> cancelResult = controller.cancelAuthUser(userRole);
        ApiResult<Void> cancelAllResult = controller.cancelAuthUserAll(1L, userIds);
        ApiResult<Void> selectAllResult = controller.selectAuthUserAll(1L, userIds);

        assertEquals(ApiResult.SUCCESS, removeResult.getCode());
        assertEquals(ApiResult.SUCCESS, cancelResult.getCode());
        assertEquals(ApiResult.SUCCESS, cancelAllResult.getCode());
        assertEquals(ApiResult.SUCCESS, selectAllResult.getCode());
        verify(sysRoleService).checkRoleDataScope(1L);
    }

    @Test
    @DisplayName("list/allocatedList/unallocatedList: should delegate paged query")
    void pageQueryMethodsShouldDelegate() {
        TableDataInfo<SysRoleVo> rolePage = TableDataInfo.build(List.of(new SysRoleVo()));
        TableDataInfo<SysUserVo> allocated = TableDataInfo.build(List.of(new SysUserVo()));
        TableDataInfo<SysUserVo> unallocated = TableDataInfo.build(List.of(new SysUserVo()));
        SysRoleBo roleBo = new SysRoleBo();
        SysUserBo userBo = new SysUserBo();
        PageQuery pageQuery = new PageQuery(10, 1);
        when(sysRoleService.selectPageRoleList(roleBo, pageQuery)).thenReturn(rolePage);
        when(sysUserService.selectAllocatedList(userBo, pageQuery)).thenReturn(allocated);
        when(sysUserService.selectUnallocatedList(userBo, pageQuery)).thenReturn(unallocated);

        TableDataInfo<SysRoleVo> listResult = controller.list(roleBo, pageQuery);
        TableDataInfo<SysUserVo> allocatedResult = controller.allocatedList(userBo, pageQuery);
        TableDataInfo<SysUserVo> unallocatedResult = controller.unallocatedList(userBo, pageQuery);

        assertEquals(1, listResult.getRows().size());
        assertEquals(1, allocatedResult.getRows().size());
        assertEquals(1, unallocatedResult.getRows().size());
    }

    @Test
    @DisplayName("export: should query rows and invoke excel util")
    void exportShouldQueryRowsAndInvokeExcelUtil() {
        SysRoleBo bo = new SysRoleBo();
        List<SysRoleVo> rows = List.of(new SysRoleVo());
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);
        when(sysRoleService.selectRoleList(bo)).thenReturn(rows);

        try (MockedStatic<ExcelUtil> excelUtil = mockStatic(ExcelUtil.class)) {
            controller.export(bo, response);
            excelUtil.verify(() -> ExcelUtil.exportExcel(rows, "角色数据", SysRoleVo.class, response));
        }
    }

    @Test
    @DisplayName("roleDeptTreeselect: should assemble checked keys and department tree")
    void roleDeptTreeselectShouldAssembleCheckedKeysAndTree() {
        when(sysDeptService.selectDeptListByRoleId(3L)).thenReturn(List.of(1L, 2L));
        when(sysDeptService.selectDeptTreeList(org.mockito.ArgumentMatchers.any())).thenReturn(List.<Tree<Long>>of());

        ApiResult<SysRoleController.DeptTreeSelectVo> result = controller.roleDeptTreeselect(3L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(List.of(1L, 2L), result.getData().checkedKeys());
        assertEquals(0, result.getData().depts().size());
    }
}
