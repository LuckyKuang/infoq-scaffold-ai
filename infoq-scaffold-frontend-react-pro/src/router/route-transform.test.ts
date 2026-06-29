import {getMenuData} from '@ant-design/pro-components/es/layout/utils/getMenuData';
import {describe, expect, it, vi} from 'vitest';
import {buildRouteComponentMap, findFirstConcreteChildPath, toProMenuRoutes,} from './route-transform';

describe('toProMenuRoutes', () => {
  it('keeps backend menu titles out of ProLayout intl lookup', () => {
    const menuRoutes = toProMenuRoutes([
      {
        path: '/system',
        name: 'System',
        component: 'Layout',
        meta: { title: '系统管理', icon: 'setting' },
        children: [
          {
            path: 'user',
            name: 'User',
            component: 'system/user/index',
            meta: { title: '用户管理' },
          },
        ],
      },
    ]);
    const formatMessage = vi.fn(({ defaultMessage }) => defaultMessage);

    const { menuData } = getMenuData(
      menuRoutes,
      { locale: true },
      formatMessage,
    );

    expect(formatMessage).not.toHaveBeenCalled();
    expect(menuData[0]).toMatchObject({
      key: '/system',
      name: '系统管理',
      locale: false,
    });
    expect(menuData[0]?.children?.[0]).toMatchObject({
      key: 'user',
      name: '用户管理',
      locale: false,
    });
  });

  it('maps activeMenu and breadcrumb visibility metadata for ProLayout', () => {
    const menuRoutes = toProMenuRoutes([
      {
        path: '/system/user/detail',
        name: 'UserDetail',
        component: 'system/user/detail',
        hidden: true,
        meta: {
          title: '用户详情',
          activeMenu: '/system/user',
          breadcrumb: false,
        },
      },
    ]);

    expect(menuRoutes[0]).toMatchObject({
      key: '/system/user/detail',
      hideInMenu: true,
      hideInBreadcrumb: true,
      parentKeys: ['/system/user'],
    });
  });

  it('finds the first concrete child route for ParentView menu groups', () => {
    const routeComponentMap = buildRouteComponentMap([
      {
        path: '/system/log',
        name: 'Log',
        component: 'ParentView',
        meta: { title: '日志管理' },
        children: [
          {
            path: 'loginInfo',
            name: 'LoginInfo',
            component: 'monitor/loginInfo/index',
            meta: { title: '登录日志' },
          },
          {
            path: 'operLog',
            name: 'OperLog',
            component: 'monitor/operLog/index',
            meta: { title: '操作日志' },
          },
        ],
      },
    ]);

    expect(findFirstConcreteChildPath(routeComponentMap, '/system/log')).toBe(
      '/system/log/loginInfo',
    );
  });
});
