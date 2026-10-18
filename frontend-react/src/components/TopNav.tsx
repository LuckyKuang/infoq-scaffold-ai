import { Dropdown, Menu, Typography, theme } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

type TopNavProps = {
  visibleNumber?: number;
};

export default function TopNav({ visibleNumber = 8 }: TopNavProps) {
  const navigate = useNavigate();
  const topbarRouters = usePermissionStore((state) => state.topbarRouters);
  const setSidebarRouters = usePermissionStore((state) => state.setSidebarRouters);
  const allRoutes = usePermissionStore((state) => state.routes);
  const {
    token: { colorText, colorTextSecondary }
  } = theme.useToken();

  const topMenus = useMemo(() => resolveTopMenus(topbarRouters), [topbarRouters]);

  const visibleMenus = topMenus.slice(0, visibleNumber);
  const overflowMenus = topMenus.slice(visibleNumber);

  const activateSidebar = (menuPath: string) => {
    const menu = allRoutes.find((item) => item.path === menuPath);
    if (!menu?.children || menu.children.length === 0) {
      return;
    }
    const children = menu.children.map((child) => ({
      ...child,
      parentPath: menuPath
    }));
    setSidebarRouters(children);
  };

  const handleSelect = (path: string) => {
    if (isHttp(path)) {
      window.open(path, '_blank');
      return;
    }
    activateSidebar(path);
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
        selectedKeys={[]}
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
