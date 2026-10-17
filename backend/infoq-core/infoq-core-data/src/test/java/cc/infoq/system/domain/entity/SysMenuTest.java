package cc.infoq.system.domain.entity;

import cc.infoq.common.constant.Constants;
import cc.infoq.common.constant.SystemConstants;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("dev")
class SysMenuTest {

    @Test
    @DisplayName("getRouteName: should return empty for top-level menu frame")
    void getRouteNameShouldReturnEmptyForMenuFrame() {
        SysMenu menu = new SysMenu();
        menu.setParentId(Constants.TOP_PARENT_ID);
        menu.setMenuType(SystemConstants.TYPE_MENU);
        menu.setIsFrame(SystemConstants.NO_FRAME);
        menu.setPath("dashboard");

        assertEquals("", menu.getRouteName());
    }

    @Test
    @DisplayName("getRouteName: should capitalize non-menu-frame route path")
    void getRouteNameShouldCapitalizePathForCommonMenu() {
        SysMenu menu = new SysMenu();
        menu.setParentId(10L);
        menu.setMenuType(SystemConstants.TYPE_MENU);
        menu.setIsFrame(SystemConstants.YES_FRAME);
        menu.setPath("dashboard");

        assertEquals("Dashboard", menu.getRouteName());
    }

    @Test
    @DisplayName("getRouterPath: should convert inner link on non-top parent")
    void getRouterPathShouldConvertInnerLinkOnChild() {
        SysMenu menu = new SysMenu();
        menu.setParentId(100L);
        menu.setMenuType(SystemConstants.TYPE_MENU);
        menu.setIsFrame(SystemConstants.NO_FRAME);
        menu.setPath("https://www.example.com:8443/portal");

        assertEquals("example/com/8443/portal", menu.getRouterPath());
    }

    @Test
    @DisplayName("getRouterPath: should add slash for top directory with no-frame")
    void getRouterPathShouldPrefixSlashForTopDirectory() {
        SysMenu menu = new SysMenu();
        menu.setParentId(Constants.TOP_PARENT_ID);
        menu.setMenuType(SystemConstants.TYPE_DIR);
        menu.setIsFrame(SystemConstants.NO_FRAME);
        menu.setPath("system");

        assertEquals("/system", menu.getRouterPath());
    }

    @Test
    @DisplayName("getRouterPath: should return slash for menu frame")
    void getRouterPathShouldReturnSlashForMenuFrame() {
        SysMenu menu = new SysMenu();
        menu.setParentId(Constants.TOP_PARENT_ID);
        menu.setMenuType(SystemConstants.TYPE_MENU);
        menu.setIsFrame(SystemConstants.NO_FRAME);
        menu.setPath("profile");

        assertEquals("/", menu.getRouterPath());
    }

    @Test
    @DisplayName("getComponentInfo: should return component when explicitly configured")
    void getComponentInfoShouldReturnConfiguredComponent() {
        SysMenu menu = new SysMenu();
        menu.setParentId(2L);
        menu.setMenuType(SystemConstants.TYPE_MENU);
        menu.setIsFrame(SystemConstants.YES_FRAME);
        menu.setPath("users");
        menu.setComponent("system/user/index");

        assertEquals("system/user/index", menu.getComponentInfo());
    }

    @Test
    @DisplayName("getComponentInfo: should return inner-link component for child http path")
    void getComponentInfoShouldReturnInnerLinkComponent() {
        SysMenu menu = new SysMenu();
        menu.setParentId(9L);
        menu.setMenuType(SystemConstants.TYPE_MENU);
        menu.setIsFrame(SystemConstants.NO_FRAME);
        menu.setPath("https://example.com/docs");
        menu.setComponent("");

        assertEquals(SystemConstants.INNER_LINK, menu.getComponentInfo());
    }

    @Test
    @DisplayName("getComponentInfo: should return parent-view component for child directory")
    void getComponentInfoShouldReturnParentView() {
        SysMenu menu = new SysMenu();
        menu.setParentId(9L);
        menu.setMenuType(SystemConstants.TYPE_DIR);
        menu.setIsFrame(SystemConstants.YES_FRAME);
        menu.setPath("tool");
        menu.setComponent("");

        assertEquals(SystemConstants.PARENT_VIEW, menu.getComponentInfo());
        assertTrue(menu.isParentView());
        assertFalse(menu.isInnerLink());
    }

    @Test
    @DisplayName("innerLinkReplaceEach: should normalize protocol/domain separators")
    void innerLinkReplaceEachShouldNormalizeUrl() {
        assertEquals("example/com/443/path", SysMenu.innerLinkReplaceEach("https://www.example.com:443/path"));
        assertEquals("example/com", SysMenu.innerLinkReplaceEach("http://www.example.com"));
    }
}
