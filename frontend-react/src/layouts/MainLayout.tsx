import { useEffect, useMemo, useState } from 'react';
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu, theme } from 'antd';
import { CaretDownOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AppRoute } from '@/types/router';
import type { RouteComponentMapItem } from '@/router/route-transform';
import { useAppStore } from '@/store/modules/app';
import { usePermissionStore } from '@/store/modules/permission';
import { useSettingsStore } from '@/store/modules/settings';
import type { TagView } from '@/store/modules/tagsView';
import { useTagsViewStore } from '@/store/modules/tagsView';
import { useUserStore } from '@/store/modules/user';
import InfoQGit from '@/components/InfoQGit';
import NoticeBell from '@/components/NoticeBell';
import LangSelect from '@/components/LangSelect';
import ScreenFull from '@/components/ScreenFull';
import SearchMenu from '@/components/SearchMenu';
import SizeSelect from '@/components/SizeSelect';
import TopNav from '@/components/TopNav';
import SettingsDrawer from '@/layouts/SettingsDrawer';
import TagsViewBar from '@/layouts/TagsViewBar';
import KeepAliveView from '@/layouts/KeepAliveView';
import MenuIcon from '@/components/MenuIcon';
import logo from '@/assets/logo/logo.png';

const { Header, Sider, Content } = Layout;

const toMenuItems = (routes: AppRoute[]) => {
  return routes
    .filter((route) => !route.hidden)
    .map((route) => {
      const children = route.children ? toMenuItems(route.children) : undefined;
      return {
        key: route.path,
        label: route.meta?.title || route.name || route.path,
        icon: <MenuIcon iconClass={route.meta?.icon} />,
        children: children && children.length > 0 ? children : undefined
      };
    });
};

const normalizePath = (path: string) => path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

const collectAffixTags = (routes: AppRoute[]): TagView[] => {
  const tags: TagView[] = [];
  const walk = (items: AppRoute[]) => {
    items.forEach((route) => {
      const path = normalizePath(route.path);
      if (route.meta?.affix) {
        tags.push({
          fullPath: path,
          name: String(route.name || path),
          path,
          title: route.meta?.title || String(route.name || path),
          icon: route.meta?.icon,
          noCache: route.meta?.noCache,
          affix: true
        });
      }
      if (route.children && route.children.length > 0) {
        walk(route.children);
      }
    });
  };
  walk(routes);
  return tags;
};

const findBreadcrumbRouteChain = (routes: AppRoute[], targetPath: string, parents: AppRoute[] = []): AppRoute[] => {
  const normalizedTargetPath = normalizePath(targetPath);

  for (const route of routes) {
    const normalizedRoutePath = normalizePath(route.path);
    const chain = [...parents, route];

    if (normalizedRoutePath === normalizedTargetPath) {
      return chain;
    }

    if (route.children && route.children.length > 0) {
      const childChain = findBreadcrumbRouteChain(route.children, normalizedTargetPath, chain);
      if (childChain.length > 0) {
        return childChain;
      }
    }
  }

  return [];
};

const buildBreadcrumbItems = (routes: AppRoute[], pathname: string, currentRoute?: RouteComponentMapItem) => {
  const activeMenuPath = currentRoute?.meta?.activeMenu;
  const lookupPath = normalizePath(activeMenuPath || pathname);
  const matchedRoutes = findBreadcrumbRouteChain(routes, lookupPath).filter((route) => route.meta?.title && route.meta?.breadcrumb !== false);

  const items = matchedRoutes.map((route) => ({
    title: route.meta?.title || route.name || route.path
  }));

  if (lookupPath === '/index') {
    return items.length > 0 ? items : [{ title: '首页' }];
  }

  if (items.length === 0 || items[0].title !== '首页') {
    items.unshift({ title: '首页' });
  }

  const currentTitle = currentRoute?.meta?.title;
  if (currentTitle && currentTitle !== items[items.length - 1]?.title && currentRoute?.meta?.breadcrumb !== false) {
    items.push({ title: currentTitle });
  }

  return items;
};

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const sidebarOpened = useAppStore((state) => state.sidebarOpened);
  const sidebarHide = useAppStore((state) => state.sidebarHide);
  const device = useAppStore((state) => state.device);
  const toggleSideBar = useAppStore((state) => state.toggleSideBar);
  const closeSideBar = useAppStore((state) => state.closeSideBar);
  const openSideBar = useAppStore((state) => state.openSideBar);
  const toggleDevice = useAppStore((state) => state.toggleDevice);

  const allRoutes = usePermissionStore((state) => state.routes);
  const sideBarRoutes = usePermissionStore((state) => state.sidebarRouters);
  const routeComponentMap = usePermissionStore((state) => state.routeComponentMap);
  const getRouteByPath = usePermissionStore((state) => state.getRouteByPath);
  const addTagView = useTagsViewStore((state) => state.addView);
  const avatar = useUserStore((state) => state.avatar);
  const logout = useUserStore((state) => state.logout);

  const title = useSettingsStore((state) => state.title);
  const topNav = useSettingsStore((state) => state.topNav);
  const tagsView = useSettingsStore((state) => state.tagsView);
  const fixedHeader = useSettingsStore((state) => state.fixedHeader);
  const sideTheme = useSettingsStore((state) => state.sideTheme);
  const dark = useSettingsStore((state) => state.dark);
  const themeColor = useSettingsStore((state) => state.theme);
  const showSettings = useSettingsStore((state) => state.showSettings);
  const sidebarLogo = useSettingsStore((state) => state.sidebarLogo);
  const dynamicTitle = useSettingsStore((state) => state.dynamicTitle);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const currentRoute = useMemo(
    () => routeComponentMap[location.pathname] || getRouteByPath(location.pathname),
    [getRouteByPath, location.pathname, routeComponentMap]
  );

  const {
    token: { colorBgContainer, colorBgLayout, colorBorderSecondary, colorText, colorTextLightSolid, colorTextSecondary }
  } = theme.useToken();

  const items = useMemo(() => toMenuItems(sideBarRoutes), [sideBarRoutes]);
  const selectedMenuKey = useMemo(
    () => normalizePath(currentRoute?.meta?.activeMenu || location.pathname),
    [currentRoute?.meta?.activeMenu, location.pathname]
  );
  const activeMenuChain = useMemo(() => findBreadcrumbRouteChain(sideBarRoutes, selectedMenuKey), [selectedMenuKey, sideBarRoutes]);
  const breadcrumbItems = useMemo(
    () => buildBreadcrumbItems(sideBarRoutes, location.pathname, currentRoute),
    [sideBarRoutes, currentRoute, location.pathname]
  );

  useEffect(() => {
    const checkDevice = () => {
      const mobile = window.innerWidth < 992;
      toggleDevice(mobile ? 'mobile' : 'desktop');
      if (mobile) {
        closeSideBar();
      }
      if (!mobile && !sidebarOpened) {
        openSideBar();
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, [closeSideBar, openSideBar, sidebarOpened, toggleDevice]);

  useEffect(() => {
    const routeTitle = currentRoute?.meta?.title;
    document.title = dynamicTitle && routeTitle ? `${routeTitle} - ${title}` : title;
  }, [currentRoute?.meta?.title, dynamicTitle, title]);

  useEffect(() => {
    setOpenKeys(activeMenuChain.slice(0, -1).map((route) => normalizePath(route.path)));
  }, [activeMenuChain]);

  useEffect(() => {
    collectAffixTags(allRoutes).forEach((tag) => {
      addTagView(tag);
    });
  }, [addTagView, allRoutes]);

  useEffect(() => {
    if (!currentRoute) {
      return;
    }
    const path = normalizePath(location.pathname);
    const title = currentRoute.meta?.title || (currentRoute.name ? String(currentRoute.name) : '');
    if (!title) {
      return;
    }
    addTagView({
      fullPath: `${path}${location.search}`,
      name: String(currentRoute.name || currentRoute.component || path),
      path,
      title,
      icon: currentRoute.meta?.icon,
      noCache: currentRoute.meta?.noCache,
      affix: currentRoute.meta?.affix
    });
  }, [
    addTagView,
    currentRoute,
    currentRoute?.component,
    currentRoute?.meta?.affix,
    currentRoute?.meta?.icon,
    currentRoute?.meta?.noCache,
    currentRoute?.meta?.title,
    currentRoute?.name,
    location.pathname,
    location.search
  ]);

  const hideSidebar = sidebarHide || (topNav && device === 'desktop');
  const siderWidth = device === 'mobile' ? 0 : 200;
  const effectiveSideTheme = dark ? 'theme-dark' : sideTheme;
  const menuTheme = effectiveSideTheme === 'theme-light' ? 'light' : 'dark';
  const sidebarTextColor = menuTheme === 'dark' ? colorTextLightSolid : colorText;
  const layoutClassName = ['layout-shell', effectiveSideTheme, sidebarOpened ? 'openSidebar' : 'hideSidebar', hideSidebar ? 'sidebarHide' : '', device]
    .filter(Boolean)
    .join(' ');
  const userMenuItems = useMemo(
    () => [
      {
        key: 'profile',
        label: t('navbar.personalCenter')
      },
      ...(showSettings
        ? [
            {
              key: 'layout',
              label: t('navbar.layoutSetting')
            }
          ]
        : []),
      {
        type: 'divider' as const
      },
      {
        key: 'logout',
        label: t('common.logout')
      }
    ],
    [showSettings, t]
  );

  return (
    <Layout
      className={layoutClassName}
      style={{
        minHeight: '100vh',
        background: colorBgLayout,
        ['--current-color' as string]: themeColor,
        ['--menu-bg' as string]: dark ? colorBgContainer : undefined
      }}
    >
      {!hideSidebar && (
        <Sider
          className="layout-sider"
          trigger={null}
          collapsible
          collapsed={!sidebarOpened}
          width={siderWidth}
          collapsedWidth={device === 'mobile' ? 0 : 54}
          theme={menuTheme}
        >
          {sidebarLogo ? (
            <div className={`sidebar-logo-container ${sidebarOpened ? 'expand' : 'collapse'}`}>
              <img src={logo} alt="logo" className="sidebar-logo" />
              {sidebarOpened && (
                <span className="sidebar-title" style={{ color: sidebarTextColor }}>
                  {import.meta.env.VITE_APP_LOGO_TITLE || title}
                </span>
              )}
            </div>
          ) : null}
          <Menu
            className="sidebar-menu"
            theme={menuTheme}
            mode="inline"
            selectedKeys={[selectedMenuKey]}
            openKeys={openKeys}
            items={items}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            onClick={(evt) => {
              navigate(evt.key);
              if (device === 'mobile') {
                closeSideBar();
              }
            }}
          />
        </Sider>
      )}
      <Layout className="layout-main">
        <Header
          className={`layout-header ${fixedHeader ? 'fixed-header' : ''}`}
          style={{
            background: colorBgContainer,
            borderBottom: dark ? 'none' : `1px solid ${colorBorderSecondary}`
          }}
        >
          <div className="layout-header-left">
            {!hideSidebar && (
              <Button
                className="hamburger-container"
                type="text"
                icon={sidebarOpened ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                onClick={toggleSideBar}
              />
            )}
            <Breadcrumb data-testid="main-breadcrumb" items={breadcrumbItems} />
            {topNav && <TopNav />}
          </div>
          <div className="layout-right-menu">
            {device !== 'mobile' && (
              <>
                <SearchMenu />
                <NoticeBell />
                <InfoQGit />
                <ScreenFull />
                <LangSelect />
                <SizeSelect />
              </>
            )}
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: async ({ key }) => {
                  if (key === 'profile') {
                    navigate('/user/profile');
                    return;
                  }
                  if (key === 'layout') {
                    setSettingsOpen(true);
                    return;
                  }
                  if (key === 'logout') {
                    await logout();
                    navigate('/login');
                  }
                }
              }}
            >
              <div className="avatar-container">
                <div className="avatar-wrapper" style={{ color: colorTextSecondary }}>
                  <Avatar className="user-avatar" shape="square" size={40} src={avatar || undefined} icon={<UserOutlined />} />
                  <CaretDownOutlined className="avatar-arrow" />
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        {tagsView && <TagsViewBar activePath={location.pathname} />}

        <Content className="layout-content">
          <KeepAliveView activePath={location.pathname} noCache={currentRoute?.meta?.noCache}>
            <Outlet />
          </KeepAliveView>
        </Content>
      </Layout>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Layout>
  );
}
