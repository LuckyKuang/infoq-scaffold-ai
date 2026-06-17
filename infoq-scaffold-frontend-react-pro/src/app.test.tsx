import {beforeEach, describe, expect, it, vi} from 'vitest';

const mockReplace = vi.fn();
const mockHistory = {
  location: {
    pathname: '/index',
    search: '',
    hash: '',
  },
  replace: mockReplace,
};

const mockGetInfo = vi.fn();
const mockGetRouters = vi.fn();

vi.mock('@umijs/max', () => ({
  history: mockHistory,
  Link: ({ children }: any) => children,
}));

vi.mock('@/services/ant-design-pro/api', () => ({
  getInfo: mockGetInfo,
  getRouters: mockGetRouters,
}));

vi.mock('@/components', () => ({
  AvatarDropdown: () => null,
  DocLink: () => null,
  ErrorBoundary: ({ children }: any) => children,
  Footer: () => null,
  LangDropdown: () => null,
  LayoutTagsView: () => null,
  OfflineBanner: () => null,
}));

vi.mock('@/components/SvgIcon', () => ({
  default: () => null,
}));

vi.mock('@ant-design/pro-components', () => ({
  SettingDrawer: () => null,
}));

vi.mock('./requestErrorConfig', () => ({
  errorConfig: {},
}));

vi.mock('../config/defaultSettings', () => ({
  default: { navTheme: 'light' },
}));

const mockUserInfo = {
  code: 200,
  data: {
    user: {
      userId: 1,
      userName: 'admin',
      nickName: 'Admin User',
      avatar: 'avatar.png',
    },
    roles: ['admin'],
    permissions: ['*:*:*'],
  },
};

const mockRoutes = {
  code: 200,
  data: [
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
  ],
};

describe('app getInitialState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('Admin-Token', 'token-123');
    mockHistory.location = {
      pathname: '/index',
      search: '',
      hash: '',
    };
    mockGetInfo.mockResolvedValue(mockUserInfo);
    mockGetRouters.mockResolvedValue(mockRoutes);
  });

  it('should fetch current user and backend menu when token exists', async () => {
    const { getInitialState } = await import('./app');

    const state = await getInitialState();

    expect(mockGetInfo).toHaveBeenCalled();
    expect(mockGetRouters).toHaveBeenCalled();
    expect(state.currentUser).toMatchObject({
      name: 'Admin User',
      access: 'admin',
      roles: ['admin'],
      permissions: ['*:*:*'],
    });
    expect(state.menuRoute?.routes?.[0]).toMatchObject({
      name: '首页',
      locale: false,
    });
    expect(state.menuRoute?.routes?.[1]).toMatchObject({
      name: '系统管理',
      locale: false,
    });
    expect(state.menuRoute?.routes?.[1]?.routes?.[0]).toMatchObject({
      name: '用户管理',
      locale: false,
    });
    expect(state.routeComponentMap?.['/system/user']?.component).toBe(
      'system/user/index',
    );
  });

  it('should redirect to login when bootstrap fails', async () => {
    const { getInitialState } = await import('./app');
    mockGetInfo.mockRejectedValue(new Error('401 Unauthorized'));

    const state = await getInitialState();

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('/login?redirect='),
    );
    expect(state.currentUser).toBeUndefined();
    expect(localStorage.getItem('Admin-Token')).toBeNull();
  });

  it('should not fetch current user on login page', async () => {
    const { getInitialState } = await import('./app');
    mockHistory.location = {
      pathname: '/login',
      search: '',
      hash: '',
    };

    const state = await getInitialState();

    expect(mockGetInfo).not.toHaveBeenCalled();
    expect(mockGetRouters).not.toHaveBeenCalled();
    expect(state.currentUser).toBeUndefined();
    expect(state.fetchUserInfo).toBeDefined();
  });

  it('should encode redirect path correctly on 401', async () => {
    const { getInitialState } = await import('./app');
    mockHistory.location = {
      pathname: '/admin/users',
      search: '?page=2',
      hash: '#section',
    };
    mockGetInfo.mockRejectedValue(new Error('401'));

    await getInitialState();

    expect(mockReplace).toHaveBeenCalledWith(
      `/login?redirect=${encodeURIComponent('/admin/users?page=2#section')}`,
    );
  });

  it('should include default settings in initial state', async () => {
    const { getInitialState } = await import('./app');

    const state = await getInitialState();

    expect(state.settings).toEqual({ navTheme: 'light' });
  });

  it('should use scaffold base API for request config', async () => {
    const { request } = await import('./app');

    expect(request.baseURL).toBe(process.env.VITE_APP_BASE_API || '/dev-api');
  });

  it('should not expose internal request constants as Umi runtime plugins', async () => {
    const appModule = await import('./app');

    expect(appModule).not.toHaveProperty('appBaseApi');
  });

  it('should render backend menu icon names as SvgIcon nodes', async () => {
    const { layout } = await import('./app');
    const layoutConfig = layout({
      initialState: {
        settings: {},
      },
      setInitialState: vi.fn(),
    } as any);

    const menuData = layoutConfig.menuDataRender?.([
      {
        path: '/system',
        name: '系统管理',
        icon: 'system',
        children: [
          {
            path: '/system/user',
            name: '用户管理',
            icon: 'user',
          },
        ],
      },
    ] as any);

    expect(menuData?.[0]?.icon).toMatchObject({
      props: {
        iconClass: 'system',
      },
    });
    expect(menuData?.[0]?.children?.[0]?.icon).toMatchObject({
      props: {
        iconClass: 'user',
      },
    });
  });

  it('fetchUserInfo should return bootstrapped auth state', async () => {
    const { getInitialState } = await import('./app');

    const state = await getInitialState();

    const authState = await state.fetchUserInfo?.();
    expect(authState?.currentUser.name).toBe('Admin User');
    expect(authState?.routeComponentMap['/system/user']?.component).toBe(
      'system/user/index',
    );
  });
});
