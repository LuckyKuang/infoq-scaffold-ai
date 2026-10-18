package cc.infoq.system.service.impl;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.constant.SystemConstants;
import cc.infoq.common.security.auth.LoginUserContext;
import cc.infoq.common.utils.SpringUtils;
import cc.infoq.system.domain.bo.SysMenuBo;
import cc.infoq.system.domain.entity.SysMenu;
import cc.infoq.system.domain.entity.SysRole;
import cc.infoq.system.domain.vo.RouterVo;
import cc.infoq.system.domain.vo.SysMenuVo;
import cc.infoq.system.mapper.SysMenuMapper;
import cc.infoq.system.mapper.SysRoleMapper;
import cc.infoq.system.mapper.SysRoleMenuMapper;
import cn.hutool.core.lang.tree.Tree;
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

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("dev")
class SysMenuServiceImplTest {

    @Mock
    private SysMenuMapper sysMenuMapper;

    @Mock
    private SysRoleMapper sysRoleMapper;

    @Mock
    private SysRoleMenuMapper sysRoleMenuMapper;

    private Converter converter;

    @BeforeEach
    void setUp() {
        converter = org.mockito.Mockito.mock(Converter.class);
        GenericApplicationContext context = new GenericApplicationContext();
        context.registerBean(Converter.class, () -> converter);
        context.refresh();
        new SpringUtils().setApplicationContext(context);
    }

    @Test
    @DisplayName("buildMenus: should build nested routers for directory menu")
    void buildMenusShouldBuildNestedRouters() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenu root = new SysMenu();
        root.setMenuId(1L);
        root.setParentId(Constants.TOP_PARENT_ID);
        root.setPath("system");
        root.setMenuName("System");
        root.setMenuType(SystemConstants.TYPE_DIR);
        root.setVisible("0");
        root.setIsFrame(SystemConstants.NO_FRAME);
        root.setIsCache("0");
        root.setComponent("Layout");
        SysMenu child = new SysMenu();
        child.setMenuId(2L);
        child.setParentId(1L);
        child.setPath("user");
        child.setMenuName("User");
        child.setMenuType(SystemConstants.TYPE_MENU);
        child.setVisible("0");
        child.setIsFrame(SystemConstants.NO_FRAME);
        child.setIsCache("0");
        child.setComponent("system/user/index");
        root.setChildren(List.of(child));

        List<RouterVo> routers = service.buildMenus(List.of(root));

        assertEquals(1, routers.size());
        assertTrue(Boolean.TRUE.equals(routers.get(0).getAlwaysShow()));
        assertNotNull(routers.get(0).getChildren());
        assertEquals(1, routers.get(0).getChildren().size());
        assertEquals("user", routers.get(0).getChildren().get(0).getPath());
    }

    @Test
    @DisplayName("buildMenuTreeSelect: should build tree node list")
    void buildMenuTreeSelectShouldBuildTreeNodes() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuVo root = new SysMenuVo();
        root.setMenuId(1L);
        root.setParentId(0L);
        root.setMenuName("System");
        root.setOrderNum(1);
        root.setMenuType(SystemConstants.TYPE_DIR);
        root.setVisible("0");
        root.setStatus("0");
        SysMenuVo child = new SysMenuVo();
        child.setMenuId(2L);
        child.setParentId(1L);
        child.setMenuName("User");
        child.setOrderNum(1);
        child.setMenuType(SystemConstants.TYPE_MENU);
        child.setVisible("0");
        child.setStatus("0");

        List<Tree<Long>> trees = service.buildMenuTreeSelect(List.of(root, child));

        assertEquals(1, trees.size());
        assertEquals(1L, trees.get(0).getId());
        assertEquals(1, trees.get(0).getChildren().size());
    }

    @Test
    @DisplayName("checkRouteConfigUnique: should always return true for button type")
    void checkRouteConfigUniqueShouldReturnTrueForButton() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuBo menuBo = new SysMenuBo();
        menuBo.setMenuType(SystemConstants.TYPE_BUTTON);
        menuBo.setParentId(1L);
        menuBo.setPath("edit");

        assertTrue(service.checkRouteConfigUnique(menuBo));
    }

    @Test
    @DisplayName("checkRouteConfigUnique: should return false for same path under same parent")
    void checkRouteConfigUniqueShouldReturnFalseForSameLevelPath() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuBo menuBo = new SysMenuBo();
        menuBo.setMenuType(SystemConstants.TYPE_MENU);
        menuBo.setParentId(1L);
        menuBo.setPath("user");

        SysMenu dbMenu = new SysMenu();
        dbMenu.setMenuId(2L);
        dbMenu.setParentId(1L);
        dbMenu.setPath("user");
        dbMenu.setMenuName("用户管理");
        when(sysMenuMapper.selectList(any())).thenReturn(List.of(dbMenu));

        assertFalse(service.checkRouteConfigUnique(menuBo));
    }

    @Test
    @DisplayName("checkRouteConfigUnique: should return false when route name already exists")
    void checkRouteConfigUniqueShouldReturnFalseForDuplicateRouteName() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuBo menuBo = new SysMenuBo();
        menuBo.setMenuType(SystemConstants.TYPE_MENU);
        menuBo.setParentId(1L);
        menuBo.setPath("user");
        menuBo.setIsFrame(SystemConstants.NO_FRAME);

        SysMenu dbMenu = new SysMenu();
        dbMenu.setMenuId(2L);
        dbMenu.setParentId(2L);
        dbMenu.setPath("User");
        dbMenu.setMenuType(SystemConstants.TYPE_MENU);
        dbMenu.setIsFrame(SystemConstants.NO_FRAME);
        dbMenu.setMenuName("个人中心");
        when(sysMenuMapper.selectList(any())).thenReturn(List.of(dbMenu));

        assertFalse(service.checkRouteConfigUnique(menuBo));
    }

    @Test
    @DisplayName("checkRouteConfigUnique: should return true when no conflicting routes exist")
    void checkRouteConfigUniqueShouldReturnTrueWhenNoConflict() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuBo menuBo = new SysMenuBo();
        menuBo.setMenuType(SystemConstants.TYPE_MENU);
        menuBo.setParentId(1L);
        menuBo.setPath("user");
        when(sysMenuMapper.selectList(any())).thenReturn(List.of());

        assertTrue(service.checkRouteConfigUnique(menuBo));
    }

    @Test
    @DisplayName("selectMenuList: should return empty when non-admin has no authorized menus")
    void selectMenuListShouldReturnEmptyWhenNoAuthorizedMenu() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(2L)).thenReturn(false);
            when(sysMenuMapper.selectMenuIdsByUserId(2L)).thenReturn(List.of());

            List<SysMenuVo> list = service.selectMenuList(new SysMenuBo(), 2L);

            assertTrue(list.isEmpty());
        }
    }

    @Test
    @DisplayName("selectMenuList: should query list with user menu ids when non-admin")
    void selectMenuListShouldQueryByMenuIdsWhenNonAdmin() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuVo vo = new SysMenuVo();
        vo.setMenuId(10L);
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(3L)).thenReturn(false);
            when(sysMenuMapper.selectMenuIdsByUserId(3L)).thenReturn(List.of(10L, 11L));
            when(sysMenuMapper.selectVoList(any())).thenReturn(List.of(vo));

            List<SysMenuVo> list = service.selectMenuList(new SysMenuBo(), 3L);

            assertEquals(1, list.size());
            assertEquals(10L, list.get(0).getMenuId());
        }
    }

    @Test
    @DisplayName("selectMenuTreeByUserId: should build parent-child tree for admin")
    void selectMenuTreeByUserIdShouldBuildTreeForAdmin() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenu parent = new SysMenu();
        parent.setMenuId(1L);
        parent.setParentId(Constants.TOP_PARENT_ID);
        parent.setMenuType(SystemConstants.TYPE_DIR);
        parent.setStatus(SystemConstants.NORMAL);

        SysMenu child = new SysMenu();
        child.setMenuId(2L);
        child.setParentId(1L);
        child.setMenuType(SystemConstants.TYPE_MENU);
        child.setStatus(SystemConstants.NORMAL);

        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(1L)).thenReturn(true);
            when(sysMenuMapper.selectMenuTreeAll()).thenReturn(List.of(parent, child));

            List<SysMenu> tree = service.selectMenuTreeByUserId(1L);

            assertEquals(1, tree.size());
            assertEquals(1L, tree.get(0).getMenuId());
            assertNotNull(tree.get(0).getChildren());
            assertEquals(1, tree.get(0).getChildren().size());
            assertEquals(2L, tree.get(0).getChildren().get(0).getMenuId());
        }
    }

    @Test
    @DisplayName("checkMenuNameUnique: should return false when menu name exists under same parent")
    void checkMenuNameUniqueShouldReturnFalseWhenMenuExistsUnderSameParent() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuBo bo = new SysMenuBo();
        bo.setMenuId(100L);
        bo.setParentId(1L);
        bo.setMenuName("用户管理");
        when(sysMenuMapper.exists(any())).thenReturn(true);

        assertFalse(service.checkMenuNameUnique(bo));
    }

    @Test
    @DisplayName("checkMenuNameUnique: should return true when menu name is unique")
    void checkMenuNameUniqueShouldReturnTrueWhenMenuIsUnique() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuBo bo = new SysMenuBo();
        bo.setParentId(1L);
        bo.setMenuName("审计日志");
        when(sysMenuMapper.exists(any())).thenReturn(false);

        assertTrue(service.checkMenuNameUnique(bo));
    }

    @Test
    @DisplayName("selectMenuList(Long): should delegate to overloaded query and return rows")
    void selectMenuListByUserIdShouldDelegateToOverloadedQuery() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuVo vo = new SysMenuVo();
        vo.setMenuId(12L);
        try (MockedStatic<LoginUserContext> loginHelper = mockStatic(LoginUserContext.class)) {
            loginHelper.when(() -> LoginUserContext.isSuperAdmin(7L)).thenReturn(false);
            when(sysMenuMapper.selectMenuIdsByUserId(7L)).thenReturn(List.of(12L));
            when(sysMenuMapper.selectVoList(any())).thenReturn(List.of(vo));

            List<SysMenuVo> menus = service.selectMenuList(7L);

            assertEquals(1, menus.size());
            assertEquals(12L, menus.get(0).getMenuId());
        }
    }

    @Test
    @DisplayName("selectMenuPerms: should delegate to mapper for user and role")
    void selectMenuPermsShouldDelegateToMapper() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        when(sysMenuMapper.selectMenuPermsByUserId(3L)).thenReturn(Set.of("system:user:list"));
        when(sysMenuMapper.selectMenuPermsByRoleId(5L)).thenReturn(Set.of("system:user:add"));

        Set<String> userPerms = service.selectMenuPermsByUserId(3L);
        Set<String> rolePerms = service.selectMenuPermsByRoleId(5L);

        assertEquals(Set.of("system:user:list"), userPerms);
        assertEquals(Set.of("system:user:add"), rolePerms);
    }

    @Test
    @DisplayName("selectMenuListByRoleId: should respect role strict flag")
    void selectMenuListByRoleIdShouldUseRoleStrictFlag() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysRole role = new SysRole();
        role.setRoleId(9L);
        role.setMenuCheckStrictly(true);
        when(sysRoleMapper.selectById(9L)).thenReturn(role);
        when(sysMenuMapper.selectMenuListByRoleId(9L, true)).thenReturn(List.of(1L, 2L));

        List<Long> menuIds = service.selectMenuListByRoleId(9L);

        assertEquals(List.of(1L, 2L), menuIds);
    }

    @Test
    @DisplayName("menu basic CRUD helpers: should delegate mapper and relation checks")
    void menuBasicCrudHelpersShouldDelegate() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuVo vo = new SysMenuVo();
        vo.setMenuId(8L);
        when(sysMenuMapper.selectVoById(8L)).thenReturn(vo);
        when(sysMenuMapper.exists(any())).thenReturn(true, false);
        when(sysRoleMenuMapper.exists(any())).thenReturn(true);
        when(sysMenuMapper.deleteById(8L)).thenReturn(1);

        assertEquals(8L, service.selectMenuById(8L).getMenuId());
        assertTrue(service.hasChildByMenuId(8L));
        assertFalse(service.hasChildByMenuId(List.of(8L, 9L)));
        assertTrue(service.checkMenuExistRole(8L));
        assertEquals(1, service.deleteMenuById(8L));
    }

    @Test
    @DisplayName("insertMenu/updateMenu/deleteMenuById(list): should convert and persist")
    void insertUpdateAndBatchDeleteShouldConvertAndPersist() {
        SysMenuServiceImpl service = new SysMenuServiceImpl(sysMenuMapper, sysRoleMapper, sysRoleMenuMapper);
        SysMenuBo bo = new SysMenuBo();
        bo.setMenuId(20L);
        bo.setMenuName("测试菜单");
        when(sysMenuMapper.insert((SysMenu) org.mockito.ArgumentMatchers.isNull())).thenReturn(1);
        when(sysMenuMapper.updateById((SysMenu) org.mockito.ArgumentMatchers.isNull())).thenReturn(1);

        assertEquals(1, service.insertMenu(bo));
        assertEquals(1, service.updateMenu(bo));

        service.deleteMenuById(List.of(20L, 21L));
        verify(sysMenuMapper).deleteByIds(List.of(20L, 21L));
        verify(sysRoleMenuMapper).deleteByMenuIds(List.of(20L, 21L));
    }
}
