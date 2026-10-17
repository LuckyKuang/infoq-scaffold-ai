import { ElMessage } from 'element-plus/es/components/message/index';

type GuardSetupOptions = {
  token?: string;
  roles?: string[];
  getInfoReject?: boolean;
  accessRoutes?: unknown[];
};

type GuardRoute = {
  path: string;
  fullPath: string;
  meta: Record<string, unknown>;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  hash: string;
  name: string;
};

type NavigationResult = true | string | Record<string, unknown>;
type BeforeHook = (to: GuardRoute, from: GuardRoute) => Promise<NavigationResult> | NavigationResult;

const createToRoute = (path: string, fullPath?: string, title?: string) => {
  return {
    path,
    fullPath: fullPath ?? path,
    meta: title ? { title } : {},
    params: { id: '1' },
    query: { q: '1' },
    hash: '#h',
    name: 'TargetRoute'
  } as GuardRoute;
};

const loadPermissionGuard = async (options: GuardSetupOptions = {}) => {
  vi.resetModules();

  const nprogress = {
    configure: vi.fn(),
    start: vi.fn(),
    done: vi.fn()
  };
  const routerMock = {
    beforeEach: vi.fn(),
    afterEach: vi.fn(),
    addRoute: vi.fn(),
    currentRoute: {
      value: {
        fullPath: '/current/full/path'
      }
    }
  };
  const userStore = {
    roles: options.roles ?? [],
    getInfo: vi.fn(),
    logout: vi.fn(() => Promise.resolve())
  };
  const settingsStore = {
    setTitle: vi.fn()
  };
  const permissionStore = {
    generateRoutes: vi.fn()
  };
  const isRelogin = { show: false };

  if (options.getInfoReject) {
    userStore.getInfo.mockRejectedValue(new Error('get-info-failed'));
  } else {
    userStore.getInfo.mockResolvedValue(undefined);
  }
  permissionStore.generateRoutes.mockResolvedValue(
    options.accessRoutes ?? [
      { path: '/system/user', name: 'SysUser' },
      { path: 'https://docs.example.com', name: 'DocLink' }
    ]
  );

  vi.doMock('nprogress', () => ({
    default: nprogress,
    configure: nprogress.configure,
    start: nprogress.start,
    done: nprogress.done
  }));
  vi.doMock('@/router', () => ({
    default: routerMock
  }));
  vi.doMock('@/utils/auth', () => ({
    getToken: vi.fn(() => options.token ?? '')
  }));
  vi.doMock('@/utils/request', () => ({
    isRelogin
  }));
  vi.doMock('@/store/modules/user', () => ({
    useUserStore: vi.fn(() => userStore)
  }));
  vi.doMock('@/store/modules/settings', () => ({
    useSettingsStore: vi.fn(() => settingsStore)
  }));
  vi.doMock('@/store/modules/permission', () => ({
    usePermissionStore: vi.fn(() => permissionStore)
  }));

  await import('@/permission');

  const beforeHook = routerMock.beforeEach.mock.calls[0]?.[0] as BeforeHook;
  const afterHook = routerMock.afterEach.mock.calls[0]?.[0] as () => void;

  return {
    beforeHook,
    afterHook,
    nprogress,
    routerMock,
    userStore,
    settingsStore,
    permissionStore,
    isRelogin
  };
};

describe('permission route guard', () => {
  const messageMock = ElMessage as unknown as {
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to login with encoded redirect when token is missing', async () => {
    const ctx = await loadPermissionGuard();
    const result = await ctx.beforeHook(createToRoute('/system/user', '/system/user?page=1'), createToRoute('/'));

    expect(result).toBe('/login?redirect=%2Fsystem%2Fuser%3Fpage%3D1');
    expect(ctx.nprogress.start).toHaveBeenCalled();
    expect(ctx.nprogress.done).toHaveBeenCalled();
  });

  it('allows whitelist route when token is missing', async () => {
    const ctx = await loadPermissionGuard();
    const result = await ctx.beforeHook(createToRoute('/oauth/callback'), createToRoute('/'));

    expect(result).toBe(true);
  });

  it('redirects authenticated user away from login page', async () => {
    const ctx = await loadPermissionGuard({ token: 'token-a', roles: ['admin'] });
    const result = await ctx.beforeHook(createToRoute('/login'), createToRoute('/'));

    expect(result).toEqual({ path: '/' });
    expect(ctx.nprogress.done).toHaveBeenCalled();
  });

  it('allows whitelist route directly when token exists', async () => {
    const ctx = await loadPermissionGuard({ token: 'token-a', roles: ['admin'] });
    const result = await ctx.beforeHook(createToRoute('/register'), createToRoute('/'));

    expect(result).toBe(true);
    expect(ctx.userStore.getInfo).not.toHaveBeenCalled();
  });

  it('continues navigation directly when roles already exist', async () => {
    const ctx = await loadPermissionGuard({ token: 'token-a', roles: ['admin'] });
    const result = await ctx.beforeHook(createToRoute('/system/user', '/system/user', '用户管理'), createToRoute('/'));

    expect(ctx.settingsStore.setTitle).toHaveBeenCalledWith('用户管理');
    expect(ctx.userStore.getInfo).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('loads user info and dynamic routes when authenticated roles are empty', async () => {
    const ctx = await loadPermissionGuard({ token: 'token-a', roles: [] });
    const to = createToRoute('/system/menu', '/system/menu?type=1', '菜单管理');

    const result = await ctx.beforeHook(to, createToRoute('/'));

    expect(ctx.userStore.getInfo).toHaveBeenCalled();
    expect(ctx.permissionStore.generateRoutes).toHaveBeenCalled();
    expect(ctx.routerMock.addRoute).toHaveBeenCalledTimes(1);
    expect(ctx.routerMock.addRoute).toHaveBeenCalledWith(expect.objectContaining({ path: '/system/user' }));
    expect(ctx.isRelogin.show).toBe(false);
    expect(result).toBe('/system/menu?type=1');
  });

  it('handles getInfo failure by logout and fallback navigation', async () => {
    const ctx = await loadPermissionGuard({ token: 'token-a', roles: [], getInfoReject: true });
    const result = await ctx.beforeHook(createToRoute('/system/dept'), createToRoute('/'));

    expect(ctx.userStore.logout).toHaveBeenCalled();
    expect(messageMock.error).toHaveBeenCalled();
    expect(result).toEqual({ path: '/' });
    expect(ctx.isRelogin.show).toBe(false);
  });

  it('stops progress bar on afterEach hook', async () => {
    const ctx = await loadPermissionGuard({ token: 'token-a', roles: ['admin'] });
    ctx.afterHook();
    expect(ctx.nprogress.done).toHaveBeenCalled();
  });
});
