package cc.infoq.system.controller.system;

import cc.infoq.common.constant.HttpStatus;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.domain.ApiResult;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.system.domain.bo.SysMenuBo;
import cc.infoq.system.domain.entity.SysMenu;
import cc.infoq.system.domain.vo.RouterVo;
import cc.infoq.system.domain.vo.SysMenuVo;
import cc.infoq.system.service.SysMenuService;
import cn.hutool.core.lang.tree.Tree;
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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysMenuControllerTest {

    @Mock
    private SysMenuService sysMenuService;

    @InjectMocks
    private SysMenuController controller;

    @Test
    @DisplayName("getRouters: should return router tree for current user")
    void getRoutersShouldReturnRouterTreeForCurrentUser() {
        SysMenu menu = new SysMenu();
        menu.setMenuId(1L);
        RouterVo router = new RouterVo();
        router.setName("dashboard");
        when(sysMenuService.selectMenuTreeByUserId(99L)).thenReturn(List.of(menu));
        when(sysMenuService.buildMenus(List.of(menu))).thenReturn(List.of(router));

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(99L);

            ApiResult<List<RouterVo>> result = controller.getRouters();

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertEquals(1, result.getData().size());
            assertEquals("dashboard", result.getData().get(0).getName());
        }
    }

    @Test
    @DisplayName("list: should return menu list for current user")
    void listShouldReturnMenuListForCurrentUser() {
        SysMenuBo bo = new SysMenuBo();
        SysMenuVo menuVo = new SysMenuVo();
        menuVo.setMenuId(88L);
        when(sysMenuService.selectMenuList(bo, 66L)).thenReturn(List.of(menuVo));

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(66L);

            ApiResult<List<SysMenuVo>> result = controller.list(bo);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertEquals(1, result.getData().size());
            assertEquals(88L, result.getData().get(0).getMenuId());
        }
    }

    @Test
    @DisplayName("getInfo: should return menu detail by id")
    void getInfoShouldReturnMenuDetailById() {
        SysMenuVo menuVo = new SysMenuVo();
        menuVo.setMenuId(77L);
        when(sysMenuService.selectMenuById(77L)).thenReturn(menuVo);

        ApiResult<SysMenuVo> result = controller.getInfo(77L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        assertEquals(77L, result.getData().getMenuId());
    }

    @Test
    @DisplayName("treeselect: should return tree nodes for current user")
    void treeselectShouldReturnTreeNodesForCurrentUser() {
        SysMenuBo bo = new SysMenuBo();
        SysMenuVo menuVo = new SysMenuVo();
        menuVo.setMenuId(5L);
        Tree<Long> tree = new Tree<>();
        tree.setId(5L);
        when(sysMenuService.selectMenuList(bo, 12L)).thenReturn(List.of(menuVo));
        when(sysMenuService.buildMenuTreeSelect(List.of(menuVo))).thenReturn(List.of(tree));

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(12L);

            ApiResult<List<Tree<Long>>> result = controller.treeselect(bo);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertEquals(1, result.getData().size());
            assertEquals(5L, result.getData().get(0).getId());
        }
    }

    @Test
    @DisplayName("add: should fail when frame path is not http")
    void addShouldFailWhenFramePathNotHttp() {
        SysMenuBo bo = new SysMenuBo();
        bo.setMenuName("门户");
        bo.setIsFrame(SystemConstants.YES_FRAME);
        bo.setPath("/internal");
        when(sysMenuService.checkMenuNameUnique(bo)).thenReturn(true);

        ApiResult<Void> result = controller.add(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("地址必须以http"));
    }

    @Test
    @DisplayName("edit: should fail when menu name is duplicated")
    void editShouldFailWhenMenuNameDuplicated() {
        SysMenuBo bo = new SysMenuBo();
        bo.setMenuId(10L);
        bo.setParentId(1L);
        bo.setMenuName("权限管理");
        when(sysMenuService.checkMenuNameUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("菜单名称已存在"));
    }

    @Test
    @DisplayName("edit: should fail when frame path is not http")
    void editShouldFailWhenFramePathNotHttp() {
        SysMenuBo bo = new SysMenuBo();
        bo.setMenuId(10L);
        bo.setParentId(1L);
        bo.setMenuName("权限管理");
        bo.setIsFrame(SystemConstants.YES_FRAME);
        bo.setPath("/internal");
        when(sysMenuService.checkMenuNameUnique(bo)).thenReturn(true);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("地址必须以http"));
    }

    @Test
    @DisplayName("edit: should fail when parent equals self")
    void editShouldFailWhenParentEqualsSelf() {
        SysMenuBo bo = new SysMenuBo();
        bo.setMenuId(10L);
        bo.setParentId(10L);
        bo.setMenuName("权限管理");
        bo.setIsFrame(SystemConstants.NO_FRAME);
        when(sysMenuService.checkMenuNameUnique(bo)).thenReturn(true);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("上级菜单不能选择自己"));
    }

    @Test
    @DisplayName("edit: should fail when route config duplicated")
    void editShouldFailWhenRouteConfigDuplicated() {
        SysMenuBo bo = new SysMenuBo();
        bo.setMenuId(11L);
        bo.setParentId(1L);
        bo.setMenuName("系统设置");
        bo.setIsFrame(SystemConstants.NO_FRAME);
        when(sysMenuService.checkMenuNameUnique(bo)).thenReturn(true);
        when(sysMenuService.checkRouteConfigUnique(bo)).thenReturn(false);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.FAIL, result.getCode());
        assertTrue(result.getMsg().contains("路由名称或地址已存在"));
    }

    @Test
    @DisplayName("edit: should update when all validations pass")
    void editShouldUpdateWhenValidationsPass() {
        SysMenuBo bo = new SysMenuBo();
        bo.setMenuId(12L);
        bo.setParentId(1L);
        bo.setMenuName("系统设置");
        bo.setIsFrame(SystemConstants.NO_FRAME);
        when(sysMenuService.checkMenuNameUnique(bo)).thenReturn(true);
        when(sysMenuService.checkRouteConfigUnique(bo)).thenReturn(true);
        when(sysMenuService.updateMenu(bo)).thenReturn(1);

        ApiResult<Void> result = controller.edit(bo);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysMenuService).updateMenu(bo);
    }

    @Test
    @DisplayName("remove(single): should warn when child menu exists")
    void removeSingleShouldWarnWhenChildExists() {
        when(sysMenuService.hasChildByMenuId(20L)).thenReturn(true);

        ApiResult<Void> result = controller.remove(20L);

        assertEquals(HttpStatus.WARN, result.getCode());
        assertTrue(result.getMsg().contains("存在子菜单"));
    }

    @Test
    @DisplayName("remove(single): should warn when menu assigned to role")
    void removeSingleShouldWarnWhenMenuAssigned() {
        when(sysMenuService.hasChildByMenuId(21L)).thenReturn(false);
        when(sysMenuService.checkMenuExistRole(21L)).thenReturn(true);

        ApiResult<Void> result = controller.remove(21L);

        assertEquals(HttpStatus.WARN, result.getCode());
        assertTrue(result.getMsg().contains("菜单已分配"));
    }

    @Test
    @DisplayName("remove(single): should delete when no dependency")
    void removeSingleShouldDeleteWhenNoDependency() {
        when(sysMenuService.hasChildByMenuId(22L)).thenReturn(false);
        when(sysMenuService.checkMenuExistRole(22L)).thenReturn(false);
        when(sysMenuService.deleteMenuById(22L)).thenReturn(1);

        ApiResult<Void> result = controller.remove(22L);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysMenuService).deleteMenuById(22L);
    }

    @Test
    @DisplayName("remove(cascade): should warn when child menu exists")
    void removeCascadeShouldWarnWhenChildExists() {
        Long[] ids = new Long[]{1L, 2L};
        when(sysMenuService.hasChildByMenuId(List.of(1L, 2L))).thenReturn(true);

        ApiResult<Void> result = controller.remove(ids);

        assertEquals(HttpStatus.WARN, result.getCode());
        assertTrue(result.getMsg().contains("存在子菜单"));
    }

    @Test
    @DisplayName("remove(cascade): should delete and return ok")
    void removeCascadeShouldDeleteAndReturnOk() {
        Long[] ids = new Long[]{3L, 4L};
        when(sysMenuService.hasChildByMenuId(List.of(3L, 4L))).thenReturn(false);

        ApiResult<Void> result = controller.remove(ids);

        assertEquals(ApiResult.SUCCESS, result.getCode());
        verify(sysMenuService).deleteMenuById(List.of(3L, 4L));
    }

    @Test
    @DisplayName("roleMenuTreeselect: should combine checked keys and menu tree")
    void roleMenuTreeselectShouldBuildSelectVo() {
        SysMenuVo menuVo = new SysMenuVo();
        menuVo.setMenuId(100L);
        menuVo.setParentId(0L);
        menuVo.setMenuName("首页");
        Tree<Long> tree = new Tree<>();
        tree.setId(100L);
        when(sysMenuService.selectMenuList(99L)).thenReturn(List.of(menuVo));
        when(sysMenuService.selectMenuListByRoleId(8L)).thenReturn(List.of(100L));
        when(sysMenuService.buildMenuTreeSelect(List.of(menuVo))).thenReturn(List.of(tree));

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(LoginUserContext::getUserId).thenReturn(99L);
            ApiResult<SysMenuController.MenuTreeSelectVo> result = controller.roleMenuTreeselect(8L);

            assertEquals(ApiResult.SUCCESS, result.getCode());
            assertEquals(List.of(100L), result.getData().checkedKeys());
            assertEquals(1, result.getData().menus().size());
        }
    }
}
