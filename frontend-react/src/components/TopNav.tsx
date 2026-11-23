import { Dropdown, Menu, Typography, theme } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/modules/app';
import { usePermissionStore } from '@/store/modules/permission';
import type { AppRoute } from '@/types/router';
import { isHttp } from '@/utils/validate';
import MenuIcon from '@/components/MenuIcon';

const resolveTopMenus = (routes: AppRoute[]) => {
  const topMenus: AppRoute[] = [];
  routes.forEach((route) => {
    if (route.hidden) {
      return;
    }
    if (route.path === '/' && route.children && route.children.length > 0) {
      topMenus.push(route.children[0]);
      return;
    }
    topMenus.push(route);
  });
  return topMenus;
};

// 无二级菜单、不展示侧边栏的页面
const SIDEBAR_HIDDEN_PATHS = ['/index', '/user/profile'];

const resolveActiveTopPath = (pathname: string) => {
  if (SIDEBAR_HIDDEN_PATHS.includes(pathname) || pathname.lastIndexOf('/') <= 0) {
    return pathname;
  }
  return `/${pathname.slice(1).split('/')[0]}`;
};

type TopNavProps = {
  visibleNumber?: number;
};

export default function TopNav({ visibleNumber = 8 }: TopNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const topbarRouters = usePermissionStore((state) => state.topbarRouters);
  const setSidebarRouters = usePermissionStore((state) => state.setSidebarRouters);
  const resetSidebarRouters = usePermissionStore((state) => state.resetSidebarRouters);
  const allRoutes = usePermissionStore((state) => state.routes);
  const {
    token: { colorText, colorTextSecondary }
  } = theme.useToken();

  const topMenus = useMemo(() => resolveTopMenus(topbarRouters), [topbarRouters]);

  const visibleMenus = topMenus.slice(0, visibleNumber);
  const overflowMenus = topMenus.slice(visibleNumber);

  const activeTopPath = resolveActiveTopPath(pathname);

  // 顶部菜单有子菜单时侧边栏展示其子菜单，否则隐藏侧边栏；与 Vue TopNav 行为一致
  const activateSidebar = useCallback(
    (menuPath: string) => {
      const menu = allRoutes.find((item) => item.path === menuPath);
      const hasChildren = Boolean(menu?.children && menu.children.length > 0);
      if (menu?.children && hasChildren) {
        setSidebarRouters(menu.children.map((child) => ({ ...child, parentPath: menuPath })));
      }
      useAppStore.getState().toggleSideBarHide(!hasChildren);
      return hasChildren;
    },
    [allRoutes, setSidebarRouters]
  );

  useEffect(() => {
    activateSidebar(activeTopPath);
  }, [activateSidebar, activeTopPath]);

  // 关闭顶部导航后还原完整侧边栏
  useEffect(
    () => () => {
      useAppStore.getState().toggleSideBarHide(false);
      resetSidebarRouters();
    },
    [resetSidebarRouters]
  );

  const handleSelect = (path: string) => {
    if (isHttp(path)) {
      window.open(path, '_blank');
      return;
    }
    if (activateSidebar(path)) {
      return;
    }
    navigate(path);
  };

  const overflowItems = overflowMenus.map((item) => ({
    key: item.path,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <MenuIcon iconClass={item.meta?.icon} />
        {item.meta?.title || item.name || item.path}
      </span>
    )
  }));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <Menu
        mode="horizontal"
        selectedKeys={[activeTopPath]}
        overflowedIndicator={null}
        items={visibleMenus.map((item) => ({
          key: item.path,
          label: (
            <Typography.Text style={{ color: colorText, display: 'inline-flex', alignItems: 'center' }}>
              <MenuIcon iconClass={item.meta?.icon} />
              {item.meta?.title || item.name || item.path}
            </Typography.Text>
          )
        }))}
        style={{ background: 'transparent', borderBottom: 'none', minWidth: 0 }}
        onClick={({ key }) => handleSelect(key)}
      />
      {overflowItems.length > 0 && (
        <Dropdown
          menu={{
            items: overflowItems,
            onClick: ({ key }) => handleSelect(key)
          }}
          trigger={['click']}
        >
          <MoreOutlined style={{ fontSize: 16, cursor: 'pointer', color: colorTextSecondary }} />
        </Dropdown>
      )}
    </div>
  );
}
