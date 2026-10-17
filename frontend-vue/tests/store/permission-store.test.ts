import { createPinia, setActivePinia } from 'pinia';
import { ElNotification } from 'element-plus/es';

const permissionStoreMocks = vi.hoisted(() => {
  return {
    addRoute: vi.fn(),
    getRouters: vi.fn(),
    hasPermiOr: vi.fn((permissions: string[]) => permissions.includes('allow:perm')),
    hasRoleOr: vi.fn((roles: string[]) => roles.includes('admin'))
  };
});

vi.mock('@/router', () => ({
  default: {
    addRoute: permissionStoreMocks.addRoute
  },
  constantRoutes: [{ path: '/const-home', name: 'ConstHome' }],
  dynamicRoutes: [
    { path: '/dyn-perm', name: 'DynPerm', permissions: ['allow:perm'] },
    { path: '/dyn-role', name: 'DynRole', roles: ['admin'] },
    { path: '/dyn-deny', name: 'DynDeny', permissions: ['deny:perm'] }
  ]
}));

vi.mock('@/api/menu', () => ({
  getRouters: permissionStoreMocks.getRouters
}));

vi.mock('@/plugins/auth', () => ({
  default: {
    hasPermiOr: permissionStoreMocks.hasPermiOr,
    hasRoleOr: permissionStoreMocks.hasRoleOr
  }
}));

const permissionMod = await import('@/store/modules/permission');

describe('store/permission generateRoutes', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('generates sidebar/default routes and injects authorized dynamic routes', async () => {
    type RouteNode = {
      path: string;
      children?: RouteNode[];
    };

    permissionStoreMocks.getRouters.mockResolvedValueOnce({
      data: [
        {
          path: '/system',
          component: 'Layout',
          children: [
            {
              path: 'user',
              component: 'system/user/index',
              name: 'DynPerm',
              meta: { title: '用户管理' }
            }
          ]
        },
        {
          path: '/nested',
          component: 'ParentView',
          children: [
            {
              path: 'parent',
              component: 'ParentView',
              children: [
                {
                  path: 'notice',
                  component: 'system/notice/index',
                  name: 'NestedNotice'
                }
              ]
            }
          ]
        },
        {
          path: '/inner-link',
          component: 'InnerLink',
          children: [
            {
              path: 'doc',
              component: 'index',
              name: 'InnerDoc'
            }
          ]
        }
      ]
    });

    const store = permissionMod.usePermissionStore();
    const rewriteRoutes = await store.generateRoutes();

    expect(permissionStoreMocks.addRoute).toHaveBeenCalledTimes(2);
    expect(permissionStoreMocks.addRoute).toHaveBeenCalledWith(expect.objectContaining({ path: '/dyn-perm' }));
    expect(permissionStoreMocks.addRoute).toHaveBeenCalledWith(expect.objectContaining({ path: '/dyn-role' }));
    const notification = ElNotification as unknown as ReturnType<typeof vi.fn>;
    expect(notification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '路由名称重复'
      })
    );

    expect(rewriteRoutes.length).toBe(3);
    expect(rewriteRoutes.find((route: RouteNode) => route.path === '/nested')?.children?.[0]?.path).toBe('parent/notice');
    expect(store.getRoutes()[0].path).toBe('/const-home');
    expect(store.getSidebarRoutes()[0].path).toBe('/const-home');
    expect(store.getDefaultRoutes()[0].path).toBe('/const-home');
    expect(store.getTopbarRoutes()).toHaveLength(3);
  });

  it('provides non-setup hook access to permission store', () => {
    const storeFromHook = permissionMod.usePermissionStoreHook();
    const directStore = permissionMod.usePermissionStore();

    expect(storeFromHook.$id).toBe('permission');
    expect(storeFromHook.$id).toBe(directStore.$id);
  });
});
