import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, removeToken } from '@/utils/auth';
import type { LoginData } from '@/api/types';
import { BrowserSessionError } from '@/api/browser-session';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  exchangeOAuthTicket: vi.fn(),
  logout: vi.fn(),
  getInfo: vi.fn(),
  bind: vi.fn(),
  restore: vi.fn(),
  remove: vi.fn(),
  csrfClear: vi.fn(),
  routes: vi.fn(),
  initSSE: vi.fn(),
  closeSSE: vi.fn(),
  initWebSocket: vi.fn(),
  closeWebSocket: vi.fn()
}));
vi.mock('@/api/login', () => ({ login: mocks.login, exchangeOAuthTicket: mocks.exchangeOAuthTicket, logout: mocks.logout, getInfo: mocks.getInfo }));
vi.mock('@/api/browser-session', async (original) => ({
  ...(await original<typeof import('@/api/browser-session')>()),
  bindBrowserSession: mocks.bind,
  restoreBrowserSession: mocks.restore,
  deleteBrowserSession: mocks.remove,
  clearBrowserSessionCsrf: mocks.csrfClear
}));
vi.mock('@/utils/sse', () => ({ initSSE: mocks.initSSE, closeSSE: mocks.closeSSE }));
vi.mock('@/utils/websocket', () => ({ initWebSocket: mocks.initWebSocket, closeWebSocket: mocks.closeWebSocket }));
const { useUserStore } = await import('@/store/modules/user');
const { usePermissionStore } = await import('@/store/modules/permission');
const data = { username: 'admin', password: 'test-only' } as LoginData;

describe('store/user browser session lifecycle', () => {
  beforeEach(() => {
    useUserStore.getState().invalidateSession();
    vi.resetAllMocks();
    removeToken();
    localStorage.clear();
    vi.stubEnv('VITE_APP_BASE_API', '/test-api');
    vi.stubEnv('VITE_APP_CLIENT_ID', 'react-client');
    mocks.bind.mockResolvedValue(undefined);
    mocks.logout.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
    mocks.restore.mockResolvedValue({ access_token: 'restored' });
    mocks.getInfo.mockResolvedValue({ data: { user: { userName: 'admin', nickName: 'Admin', userId: 1 }, roles: ['admin'], permissions: [] } });
    mocks.routes.mockResolvedValue([]);
    usePermissionStore.setState({ generateRoutes: mocks.routes });
    useUserStore.setState({ sessionState: 'unknown', sessionError: '', bootstrapReady: false, logoutState: 'idle' });
  });

  it('binds password token before committing and starts channels only after user and routes', async () => {
    let finishBind!: () => void;
    mocks.bind.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishBind = resolve;
        })
    );
    mocks.login.mockResolvedValue({ data: { access_token: 'password-token' } });
    const login = useUserStore.getState().login(data);
    await vi.waitFor(() => expect(mocks.bind).toHaveBeenCalledWith('password-token'));
    expect(getToken()).toBe('');
    expect(mocks.initSSE).not.toHaveBeenCalled();
    finishBind();
    await login;
    expect(getToken()).toBe('password-token');
    expect(localStorage.getItem('Admin-Token')).toBeNull();
    expect(sessionStorage.getItem('Admin-Token')).toBeNull();
    expect(mocks.initSSE).not.toHaveBeenCalled();
    await useUserStore.getState().bootstrapSession();
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(mocks.getInfo.mock.invocationCallOrder[0]).toBeLessThan(mocks.routes.mock.invocationCallOrder[0]);
    expect(mocks.routes.mock.invocationCallOrder[0]).toBeLessThan(mocks.initSSE.mock.invocationCallOrder[0]);
    expect(mocks.initSSE).toHaveBeenCalledWith('/test-api/resource/sse');
    expect(useUserStore.getState()).toMatchObject({ sessionState: 'authenticated', bootstrapReady: true });
  });

  it('uses the same binding path for OAuth without restoring the previous user', async () => {
    mocks.exchangeOAuthTicket.mockResolvedValue({ data: { access_token: 'oauth-token' } });
    await useUserStore.getState().loginByOAuthTicket('one-time-ticket');
    expect(mocks.exchangeOAuthTicket).toHaveBeenCalledWith({ loginTicket: 'one-time-ticket' });
    expect(mocks.bind).toHaveBeenCalledWith('oauth-token');
    expect(getToken()).toBe('oauth-token');
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(mocks.initSSE).not.toHaveBeenCalled();
  });

  it('revokes the new bearer on binding failure and exposes cleanup failure', async () => {
    mocks.login.mockResolvedValue({ data: { access_token: 'unbound-token' } });
    mocks.bind.mockRejectedValue(new Error('bind failed'));
    await expect(useUserStore.getState().login(data)).rejects.toThrow('bind failed');
    expect(mocks.logout).toHaveBeenCalledWith('unbound-token');
    expect(getToken()).toBe('');
    mocks.logout.mockRejectedValue(new Error('offline'));
    await expect(useUserStore.getState().login(data)).rejects.toThrow('新会话撤销未获确认');
    expect(mocks.initSSE).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent refresh bootstrap and never reads legacy token', async () => {
    localStorage.setItem('Admin-Token', 'legacy-not-accepted');
    const first = useUserStore.getState().bootstrapSession();
    const second = useUserStore.getState().bootstrapSession();
    expect(first).toBe(second);
    await Promise.all([first, second]);
    await useUserStore.getState().bootstrapSession();
    expect(getToken()).toBe('restored');
    expect(mocks.restore).toHaveBeenCalledTimes(1);
    expect(mocks.getInfo).toHaveBeenCalledTimes(1);
    expect(mocks.routes).toHaveBeenCalledTimes(1);
    expect(mocks.initSSE).toHaveBeenCalledTimes(1);
  });

  it('treats only restore 401 as anonymous', async () => {
    mocks.restore.mockRejectedValue(new BrowserSessionError(401, 'missing', 'post'));
    await useUserStore.getState().bootstrapSession();
    expect(useUserStore.getState().sessionState).toBe('anonymous');
    expect(mocks.getInfo).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('does not classify a CSRF bootstrap 401 as a missing login session', async () => {
    mocks.restore.mockRejectedValue(new BrowserSessionError(401, 'csrf rejected', 'get'));
    await expect(useUserStore.getState().bootstrapSession()).rejects.toThrow('csrf rejected');
    expect(useUserStore.getState().sessionState).toBe('failed');
  });

  it('revokes a late login result without binding when logout already cancelled login', async () => {
    let finishLogin!: (value: { data: { access_token: string } }) => void;
    mocks.login.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishLogin = resolve;
        })
    );
    const login = useUserStore.getState().login(data);
    await useUserStore.getState().logout();
    finishLogin({ data: { access_token: 'cancelled-token' } });
    await expect(login).rejects.toThrow('登录已被取消');
    expect(mocks.bind).not.toHaveBeenCalled();
    expect(mocks.logout).toHaveBeenCalledWith('cancelled-token');
    expect(getToken()).toBe('');
  });

  it.each([0, 403, 503])('keeps status %s visible and allows one explicit retry', async (status) => {
    mocks.restore.mockRejectedValueOnce(new BrowserSessionError(status, `restore-${status}`));
    await expect(useUserStore.getState().bootstrapSession()).rejects.toThrow(`restore-${status}`);
    expect(useUserStore.getState()).toMatchObject({ sessionState: 'failed', token: '', roles: [], bootstrapReady: false });
    await expect(useUserStore.getState().bootstrapSession()).rejects.toThrow(`restore-${status}`);
    expect(mocks.restore).toHaveBeenCalledTimes(1);
    await useUserStore.getState().bootstrapSession(true);
    expect(mocks.restore).toHaveBeenCalledTimes(2);
    expect(useUserStore.getState().bootstrapReady).toBe(true);
  });

  it('does not resurrect authentication when logout wins an in-flight restore', async () => {
    let finishRestore!: (value: { access_token: string }) => void;
    mocks.restore.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRestore = resolve;
        })
    );
    const restore = useUserStore.getState().bootstrapSession();
    await useUserStore.getState().logout();
    finishRestore({ access_token: 'too-late' });
    await restore;
    expect(mocks.remove).toHaveBeenCalledWith();
    expect(useUserStore.getState()).toMatchObject({ sessionState: 'anonymous', token: '', bootstrapReady: false });
    expect(getToken()).toBe('');
    expect(mocks.getInfo).not.toHaveBeenCalled();
  });

  it('shares pending logout and blocks bootstrap until remote deletion completes', async () => {
    let finishDelete!: () => void;
    mocks.remove.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishDelete = resolve;
        })
    );
    const first = useUserStore.getState().logout();
    const second = useUserStore.getState().logout();
    expect(first).toBe(second);
    expect(useUserStore.getState().logoutState).toBe('pending');
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    await expect(useUserStore.getState().bootstrapSession(true)).rejects.toThrow('退出处理中');
    expect(mocks.restore).not.toHaveBeenCalled();
    finishDelete();
    await first;
    expect(useUserStore.getState()).toMatchObject({ logoutState: 'idle', sessionState: 'anonymous' });
  });

  it('clears permissions and owned connections even when server logout fails', async () => {
    await useUserStore.getState().bootstrapSession();
    usePermissionStore.setState({ routeComponentMap: { '/old': {} as never }, routes: [{ path: '/old' }] });
    mocks.remove.mockRejectedValue(new BrowserSessionError(503, 'revoke not confirmed'));
    await expect(useUserStore.getState().logout()).rejects.toThrow('revoke not confirmed');
    expect(getToken()).toBe('');
    expect(mocks.closeSSE).toHaveBeenCalled();
    expect(mocks.closeWebSocket).toHaveBeenCalled();
    expect(usePermissionStore.getState().routes).toEqual([]);
    expect(usePermissionStore.getState().routeComponentMap).toEqual({});
  });

  it('does not restore user data after logout wins an in-flight user-info response', async () => {
    let finishInfo!: (value: unknown) => void;
    mocks.getInfo.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishInfo = resolve;
        })
    );
    const bootstrap = useUserStore.getState().bootstrapSession();
    await vi.waitFor(() => expect(mocks.getInfo).toHaveBeenCalled());
    await useUserStore.getState().logout();
    finishInfo({ data: { user: { userName: 'old-user', userId: 1 }, roles: ['admin'], permissions: ['old'] } });
    await bootstrap;
    expect(useUserStore.getState()).toMatchObject({ sessionState: 'anonymous', token: '', name: '', roles: [], permissions: [] });
    expect(mocks.routes).not.toHaveBeenCalled();
    expect(mocks.initSSE).not.toHaveBeenCalled();
  });

  it('accepts only scoped credential-free tab invalidation notifications', async () => {
    await useUserStore.getState().bootstrapSession();
    const notify = (scope: string, clientId: string) =>
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'infoq:browser-session:react',
          newValue: JSON.stringify({ scope, clientId, action: 'logout' })
        })
      );
    notify('vue', 'react-client');
    notify('react', 'other-client');
    expect(getToken()).toBe('restored');
    notify('react', 'react-client');
    expect(getToken()).toBe('');
    expect(useUserStore.getState().sessionState).toBe('anonymous');
  });
});
