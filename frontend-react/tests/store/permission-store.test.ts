import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppRoute } from '@/types/router';

const getRouters = vi.fn();

vi.mock('@/api/menu', () => ({
  getRouters
}));

const { usePermissionStore } = await import('@/store/modules/permission');

describe('store/permission', () => {
  beforeEach(() => {
    getRouters.mockReset();
    usePermissionStore.setState({
      routes: [],
      addRoutes: [],
      defaultRoutes: [],
      topbarRouters: [],
      sidebarRouters: [],
      routeComponentMap: {}
    });
  });

  it('normalizes sidebar children to absolute paths and prepends home when missing', async () => {
    const backendRoutes: AppRoute[] = [
      {
        path: '/system',
        name: 'System1',
        component: 'Layout',
        meta: { title: '系统管理' },
        children: [
          {
            path: 'user',
            name: 'User2',
            component: 'system/user/index',
            meta: { title: '用户管理' }
          }
        ]
      },
      {
        path: '/monitor',
        name: 'Monitor3',
        component: 'Layout',
        meta: { title: '系统监控' },
        children: [
          {
            path: 'cache',
            name: 'Cache4',
            component: 'monitor/cache/index',
            meta: { title: '缓存监控' }
          }
        ]
      }
    ];

    getRouters.mockResolvedValue({ data: backendRoutes });

    await usePermissionStore.getState().generateRoutes();

    const { sidebarRouters, getRouteByPath, getRouteByComponent } = usePermissionStore.getState();

    expect(sidebarRouters[0]).toMatchObject({
      path: '/index',
      meta: { title: '首页', affix: true }
    });
    expect(sidebarRouters[1].children?.[0].path).toBe('/system/user');
    expect(sidebarRouters[2].children?.[0].path).toBe('/monitor/cache');
    expect(getRouteByPath('/system/user')?.component).toBe('system/user/index');
    expect(getRouteByPath('/monitor/cache')?.component).toBe('monitor/cache/index');
    expect(getRouteByPath('/index')?.component).toBe('index');
    expect(getRouteByComponent('system/user/index')?.meta?.title).toBe('用户管理');
  });

  it('keeps backend home route without duplicating the sidebar entry', async () => {
    getRouters.mockResolvedValue({
      data: [
        {
          path: '/',
          name: 'Dashboard1',
          component: 'Layout',
          children: [
            {
              path: 'index',
              name: 'Dashboard2',
              component: 'index',
              meta: { title: '首页', affix: true }
            }
          ]
        }
      ] satisfies AppRoute[]
    });

    await usePermissionStore.getState().generateRoutes();

    const homeRoutes = usePermissionStore
      .getState()
      .sidebarRouters.filter((route) => route.path === '/index');

    expect(homeRoutes).toHaveLength(1);
  });
});
