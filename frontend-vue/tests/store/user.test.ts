import { createPinia, setActivePinia } from 'pinia';
import { useUserStore } from '@/store/modules/user';
import { getToken, removeToken, setToken } from '@/utils/auth';
import type { ApiResponse, LoginData, LoginResult } from '@/api/types';
import type { UserInfo } from '@/api/system/user/types';

vi.mock('@/api/login', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/login')>()),
  login: vi.fn(),
  exchangeOAuthTicket: vi.fn(),
  logout: vi.fn(() => Promise.resolve()),
  getInfo: vi.fn(),
  bindBrowserSession: vi.fn(() => Promise.resolve()),
  restoreBrowserSession: vi.fn(),
  deleteBrowserSession: vi.fn(() => Promise.resolve()),
  clearBrowserSessionCsrf: vi.fn()
}));

const sessionMocks = vi.hoisted(() => ({
  resetRoutes: vi.fn(),
  generateRoutes: vi.fn(() => Promise.resolve([{ path: '/system/user' }])),
  installRoutes: vi.fn(),
  closeWebSocket: vi.fn(),
  clearNotice: vi.fn(),
  resetSessionViews: vi.fn()
}));
vi.mock('@/store/modules/permission', () => ({ usePermissionStore: () => sessionMocks }));
vi.mock('@/store/modules/tagsView', () => ({ useTagsViewStore: () => sessionMocks }));
vi.mock('@/store/modules/notice', () => ({ useNoticeStore: () => sessionMocks }));
vi.mock('@/utils/websocket', () => ({ closeWebSocket: sessionMocks.closeWebSocket }));

vi.mock('@/utils/sse', () => ({
  initSSE: vi.fn(),
  closeSSE: vi.fn()
}));

const { login, exchangeOAuthTicket, getInfo, logout, bindBrowserSession, restoreBrowserSession, deleteBrowserSession, BrowserSessionError } =
  await import('@/api/login');
const { initSSE, closeSSE } = await import('@/utils/sse');

describe('store/user', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    removeToken();
    vi.mocked(getInfo).mockResolvedValue({
      data: { user: { userName: 'admin', nickName: 'Admin', avatar: '', userId: 1 }, roles: ['admin'], permissions: [] }
    } as ApiResponse<UserInfo>);
  });

  it('login success should update token and defer sse init to layout', async () => {
    vi.mocked(login).mockResolvedValue({ data: { access_token: 'token-1' } } as ApiResponse<LoginResult>);
    const store = useUserStore();

    await store.login({ username: 'admin', password: '123456', code: '', uuid: '' } as LoginData);

    expect(store.token).toBe('token-1');
    expect(getToken()).toBe('token-1');
    expect(initSSE).not.toHaveBeenCalled();
  });

  it('login failure should reject', async () => {
    vi.mocked(login).mockRejectedValue(new Error('login failed'));
    const store = useUserStore();

    await expect(store.login({ username: 'u', password: 'p', code: '', uuid: '' } as LoginData)).rejects.toBeTruthy();
  });

  it('oauth ticket login success should update token without initializing sse directly', async () => {
    vi.mocked(exchangeOAuthTicket).mockResolvedValue({ data: { access_token: 'oauth-token' } } as ApiResponse<LoginResult>);
    const store = useUserStore();

    await store.loginByOAuthTicket('ticket-1');

    expect(exchangeOAuthTicket).toHaveBeenCalledWith({ loginTicket: 'ticket-1' });
    expect(store.token).toBe('oauth-token');
    expect(getToken()).toBe('oauth-token');
    expect(initSSE).not.toHaveBeenCalled();
  });

  it('getInfo should map profile without injecting fallback role', async () => {
    vi.mocked(getInfo).mockResolvedValue({
      data: {
        user: { userName: 'alice', nickName: 'Alice', avatar: '', userId: 1001 },
        roles: [],
        permissions: ['system:user:list']
      }
    } as ApiResponse<UserInfo>);

    const store = useUserStore();
    await store.getInfo();

    expect(store.name).toBe('alice');
    expect(store.nickname).toBe('Alice');
    expect(store.userId).toBe(1001);
    expect(store.roles).toEqual([]);
    expect(store.permissions).toEqual(['system:user:list']);
  });

  it('getInfo should map roles/permissions and keep custom avatar', async () => {
    vi.mocked(getInfo).mockResolvedValue({
      data: {
        user: { userName: 'bob', nickName: 'Bob', avatar: 'https://cdn/avatar.png', userId: 1002 },
        roles: ['admin', 'common'],
        permissions: ['system:user:list', 'system:role:edit']
      }
    } as ApiResponse<UserInfo>);

    const store = useUserStore();
    await store.getInfo();

    expect(store.name).toBe('bob');
    expect(store.nickname).toBe('Bob');
    expect(store.userId).toBe(1002);
    expect(store.avatar).toBe('https://cdn/avatar.png');
    expect(store.roles).toEqual(['admin', 'common']);
    expect(store.permissions).toEqual(['system:user:list', 'system:role:edit']);
  });

  it('getInfo failure should reject', async () => {
    vi.mocked(getInfo).mockRejectedValue(new Error('get-info-failed'));
    const store = useUserStore();

    await expect(store.getInfo()).rejects.toBeTruthy();
  });

  it('logout should clear token and close sse', async () => {
    const store = useUserStore();
    store.token = 'abc';
    store.roles = ['admin'];
    store.permissions = ['x'];

    await store.logout();

    expect(closeSSE).toHaveBeenCalled();
    expect(deleteBrowserSession).toHaveBeenCalled();
    expect(store.token).toBe('');
    expect(store.roles).toEqual([]);
    expect(store.permissions).toEqual([]);
  });

  it('logout should clear local session when logout api fails', async () => {
    vi.mocked(deleteBrowserSession).mockRejectedValueOnce(new Error('logout unauthorized'));
    setToken('expired-token');
    const store = useUserStore();
    store.token = 'expired-token';
    store.roles = ['admin'];
    store.permissions = ['system:user:list'];
    store.name = 'admin';
    store.nickname = 'Admin';
    store.avatar = 'avatar.png';
    store.userId = 1;

    await expect(store.logout()).rejects.toBeTruthy();

    expect(closeSSE).toHaveBeenCalled();
    expect(deleteBrowserSession).toHaveBeenCalled();
    expect(getToken()).toBeNull();
    expect(store.token).toBe('');
    expect(store.roles).toEqual([]);
    expect(store.permissions).toEqual([]);
    expect(store.name).toBe('');
    expect(store.nickname).toBe('');
    expect(store.avatar).toBe('');
    expect(store.userId).toBe('');
  });

  it('setAvatar should update avatar directly', () => {
    const store = useUserStore();
    store.setAvatar('https://new-avatar.png');
    expect(store.avatar).toBe('https://new-avatar.png');
  });

  it('waits for binding before committing password token and revokes it when binding fails', async () => {
    vi.mocked(login).mockResolvedValue({ data: { access_token: 'new-token' } } as ApiResponse<LoginResult>);
    let rejectBind!: (error: Error) => void;
    vi.mocked(bindBrowserSession).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectBind = reject;
      })
    );
    const store = useUserStore();
    const pending = store.login({ username: 'admin' } as LoginData);
    await vi.waitFor(() => expect(bindBrowserSession).toHaveBeenCalledWith('new-token'));
    expect(getToken()).toBeNull();
    rejectBind(new Error('bind failed'));
    await expect(pending).rejects.toThrow('bind failed');
    expect(logout).toHaveBeenCalledWith('new-token');
    expect(getToken()).toBeNull();
  });

  it('reports rollback failure without committing OAuth authentication', async () => {
    vi.mocked(exchangeOAuthTicket).mockResolvedValue({ data: { access_token: 'oauth-token' } } as ApiResponse<LoginResult>);
    vi.mocked(bindBrowserSession).mockRejectedValueOnce(new Error('bind failed'));
    vi.mocked(logout).mockRejectedValueOnce(new Error('cleanup failed'));
    const store = useUserStore();
    await expect(store.loginByOAuthTicket('ticket')).rejects.toThrow('撤销未确认');
    expect(store.token).toBe('');
    expect(getToken()).toBeNull();
  });

  it('deduplicates restoration and loads profile before routes without starting realtime', async () => {
    vi.mocked(restoreBrowserSession).mockResolvedValueOnce({ access_token: 'restored-token' });
    const store = useUserStore();
    const first = store.bootstrap();
    const second = store.bootstrap();
    expect(store.bootstrapState).toBe('restoring');
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(restoreBrowserSession).toHaveBeenCalledTimes(1);
    expect(getInfo).toHaveBeenCalledTimes(1);
    expect(sessionMocks.generateRoutes).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getInfo).mock.invocationCallOrder[0]).toBeLessThan(sessionMocks.generateRoutes.mock.invocationCallOrder[0]);
    expect(sessionMocks.installRoutes).toHaveBeenCalledWith([{ path: '/system/user' }]);
    expect(store.bootstrapState).toBe('authenticated');
    expect(initSSE).not.toHaveBeenCalled();
    await expect(store.bootstrap()).resolves.toBe(false);
    expect(restoreBrowserSession).toHaveBeenCalledTimes(1);
  });

  it('treats only restore 401 as anonymous and never retries implicitly', async () => {
    vi.mocked(restoreBrowserSession).mockRejectedValueOnce(new BrowserSessionError(401, 'expired', 'POST'));
    const store = useUserStore();
    await expect(store.bootstrap()).resolves.toBe(false);
    expect(store.bootstrapState).toBe('anonymous');
    await expect(store.bootstrap()).resolves.toBe(false);
    expect(restoreBrowserSession).toHaveBeenCalledTimes(1);
  });

  it.each([403, 503])('keeps restore %s as an explicit failure with local cleanup', async (status) => {
    vi.mocked(restoreBrowserSession).mockRejectedValueOnce(new BrowserSessionError(status, `failure-${status}`));
    const store = useUserStore();
    await expect(store.bootstrap()).rejects.toThrow(`failure-${status}`);
    expect(store.bootstrapState).toBe('failed');
    expect(sessionMocks.resetRoutes).toHaveBeenCalled();
    expect(sessionMocks.closeWebSocket).toHaveBeenCalled();
    await expect(store.bootstrap()).rejects.toThrow(`failure-${status}`);
    expect(restoreBrowserSession).toHaveBeenCalledTimes(1);
  });

  it('does not revive an in-flight restored token after logout', async () => {
    let resolveRestore!: (data: LoginResult) => void;
    vi.mocked(restoreBrowserSession).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRestore = resolve;
      })
    );
    const store = useUserStore();
    const pending = store.bootstrap();
    await vi.waitFor(() => expect(restoreBrowserSession).toHaveBeenCalled());
    await store.logout();
    resolveRestore({ access_token: 'late-token' });
    await expect(pending).resolves.toBe(false);
    expect(getToken()).toBeNull();
    expect(store.bootstrapState).toBe('anonymous');
    expect(getInfo).not.toHaveBeenCalled();
  });

  it('does not turn CSRF bootstrap 401 into an anonymous restore result', async () => {
    vi.mocked(restoreBrowserSession).mockRejectedValueOnce(new BrowserSessionError(401, 'CSRF endpoint denied', 'GET'));
    const store = useUserStore();
    await expect(store.bootstrap()).rejects.toThrow('CSRF endpoint denied');
    expect(store.bootstrapState).toBe('failed');
  });

  it('revokes a delayed password login response after logout before binding it', async () => {
    let finishLogin!: (data: ApiResponse<LoginResult>) => void;
    vi.mocked(login).mockReturnValueOnce(
      new Promise((resolve) => {
        finishLogin = resolve;
      })
    );
    const store = useUserStore();
    const pending = store.login({ username: 'admin' } as LoginData);
    await store.logout();
    finishLogin({ code: 200, data: { access_token: 'late-login-token' } });
    await expect(pending).rejects.toThrow('会话已发生变化');
    expect(bindBrowserSession).not.toHaveBeenCalled();
    expect(logout).toHaveBeenCalledWith('late-login-token');
    expect(getToken()).toBeNull();
  });

  it('waits for a pending server logout before starting a new login', async () => {
    let finishDelete!: () => void;
    vi.mocked(deleteBrowserSession).mockReturnValueOnce(
      new Promise((resolve) => {
        finishDelete = resolve;
      })
    );
    vi.mocked(login).mockResolvedValueOnce({ code: 200, data: { access_token: 'next-token' } });
    const store = useUserStore();
    const exiting = store.logout();
    const entering = store.login({ username: 'admin' } as LoginData);
    await Promise.resolve();
    expect(login).not.toHaveBeenCalled();
    finishDelete();
    await exiting;
    await entering;
    expect(store.token).toBe('next-token');
    expect(bindBrowserSession).toHaveBeenCalledWith('next-token');
  });

  it('does not replace interceptor-driven anonymous state with failed during profile bootstrap', async () => {
    vi.mocked(restoreBrowserSession).mockResolvedValueOnce({ access_token: 'expired-at-profile' });
    const store = useUserStore();
    vi.mocked(getInfo).mockImplementationOnce(async () => {
      store.invalidateSession();
      throw Object.assign(new Error('expired'), { status: 401 });
    });
    await expect(store.bootstrap()).resolves.toBe(false);
    expect(store.bootstrapState).toBe('anonymous');
    expect(store.bootstrapError).toBe('');
    expect(getToken()).toBeNull();
  });
});
