import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {useSessionStore} from '../../src/store/session';

const {
  mockGetInfo,
  mockGetUnreadMessageCount,
  mockGetToken,
  mockHasPermission,
  mockLogin,
  mockNormalizePermissions,
  mockLogout,
  mockRemoveToken,
  mockSetToken
} = vi.hoisted(() => ({
  mockGetInfo: vi.fn(),
  mockGetUnreadMessageCount: vi.fn(),
  mockGetToken: vi.fn(),
  mockHasPermission: vi.fn(),
  mockLogin: vi.fn(),
  mockNormalizePermissions: vi.fn(),
  mockLogout: vi.fn(),
  mockRemoveToken: vi.fn(),
  mockSetToken: vi.fn()
}));

vi.mock('@/api', () => ({
  getInfo: mockGetInfo,
  getUnreadMessageCount: mockGetUnreadMessageCount,
  getToken: mockGetToken,
  hasPermission: mockHasPermission,
  login: mockLogin,
  normalizePermissions: mockNormalizePermissions,
  logout: mockLogout,
  removeToken: mockRemoveToken,
  setToken: mockSetToken
}));

describe('store/session', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    mockGetInfo.mockReset();
    mockGetUnreadMessageCount.mockReset();
    mockGetToken.mockReset();
    mockHasPermission.mockReset();
    mockLogin.mockReset();
    mockNormalizePermissions.mockReset();
    mockLogout.mockReset();
    mockRemoveToken.mockReset();
    mockSetToken.mockReset();

    mockNormalizePermissions.mockImplementation((permissions: string[]) => permissions);
    mockHasPermission.mockImplementation((permissions: string[], permission: string) => permissions.includes(permission));
  });

  it('loadSession should clear state when token is missing', async () => {
    const store = useSessionStore();
    mockGetToken.mockReturnValue('');

    const result = await store.loadSession();

    expect(result).toBeNull();
    expect(store.initialized).toBe(true);
    expect(store.token).toBe('');
    expect(store.user).toBeNull();
  });

  it('loadSession should reuse cached state when initialized and force=false', async () => {
    const store = useSessionStore();
    mockGetToken.mockReturnValue('cached-token');
    store.$patch({
      token: 'cached-token',
      user: { userId: 1, userName: 'cached-user' },
      permissions: ['system:user:list'],
      initialized: true
    });

    const result = await store.loadSession();

    expect(mockGetInfo).not.toHaveBeenCalled();
    expect(result?.user.userName).toBe('cached-user');
    expect(result?.permissions).toEqual(['system:user:list']);
  });

  it('signIn should persist token and user info', async () => {
    const store = useSessionStore();
    mockLogin.mockResolvedValue({ data: { access_token: 'token-1' } });
    mockGetInfo.mockResolvedValue({
      data: {
        user: { userId: 100, userName: 'tester' },
        roles: [],
        permissions: ['*:*:*']
      }
    });
    mockNormalizePermissions.mockReturnValue(['system:user:list', 'monitor:online:list']);

    await store.signIn({ username: 'tester', password: 'pwd' });

    expect(mockSetToken).toHaveBeenCalledWith('token-1');
    expect(store.token).toBe('token-1');
    expect(store.user?.userName).toBe('tester');
    expect(store.permissions).toEqual(['system:user:list', 'monitor:online:list']);
    expect(store.initialized).toBe(true);
  });

  it('signIn should reject when backend omits permissions', async () => {
    const store = useSessionStore();
    mockLogin.mockResolvedValue({ data: { access_token: 'token-4' } });
    mockGetInfo.mockResolvedValue({
      data: {
        user: { userId: 101, userName: 'tester2' },
        roles: [],
        permissions: undefined
      }
    });
    await expect(store.signIn({ username: 'tester2', password: 'pwd2' })).rejects.toThrow('用户权限必须是字符串数组');

    expect(mockNormalizePermissions).not.toHaveBeenCalled();
    expect(store.permissions).toEqual([]);
  });

  it('signOut should clear state even when remote logout fails', async () => {
    const store = useSessionStore();
    mockGetToken.mockReturnValue('token-2');
    mockLogout.mockRejectedValue(new Error('logout failed'));
    store.$patch({
      token: 'token-2',
      user: { userId: 2, userName: 'u2' },
      permissions: ['system:user:list'],
      initialized: true
    });

    await expect(store.signOut()).rejects.toThrow('logout failed');

    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
    expect(store.token).toBe('');
    expect(store.user).toBeNull();
    expect(store.permissions).toEqual([]);
    expect(store.initialized).toBe(true);
  });

  it('signOut should call remote logout when token exists and clear state', async () => {
    const store = useSessionStore();
    mockGetToken.mockReturnValue('token-3');
    mockLogout.mockResolvedValue(undefined);
    store.$patch({
      token: 'token-3',
      user: { userId: 3, userName: 'u3' },
      permissions: ['system:user:list'],
      initialized: true
    });

    await store.signOut();

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
    expect(store.token).toBe('');
    expect(store.user).toBeNull();
  });

  it('loadSession(force=true) should refresh user info even when initialized', async () => {
    const store = useSessionStore();
    mockGetToken.mockReturnValue('force-token');
    mockNormalizePermissions.mockReturnValue(['system:dept:list']);
    mockGetInfo.mockResolvedValue({
      data: {
        user: { userId: 300, userName: 'forced' },
        roles: [],
        permissions: ['system:dept:list']
      }
    });
    store.$patch({
      token: 'force-token',
      user: { userId: 200, userName: 'cached' },
      permissions: ['system:user:list'],
      initialized: true
    });

    const result = await store.loadSession(true);

    expect(mockGetInfo).toHaveBeenCalledTimes(1);
    expect(result?.user.userName).toBe('forced');
    expect(result?.permissions).toEqual(['system:dept:list']);
    expect(store.token).toBe('force-token');
    expect(store.user?.userName).toBe('forced');
    expect(store.permissions).toEqual(['system:dept:list']);
    expect(store.initialized).toBe(true);
  });

  it('loadSession(force=true) should reject when backend omits permissions', async () => {
    const store = useSessionStore();
    mockGetToken.mockReturnValue('force-token-empty-permissions');
    mockGetInfo.mockResolvedValue({
      data: {
        user: { userId: 301, userName: 'forced-empty-permissions' },
        roles: [],
        permissions: undefined
      }
    });
    await expect(store.loadSession(true)).rejects.toThrow('用户权限必须是字符串数组');

    expect(mockNormalizePermissions).not.toHaveBeenCalled();
    expect(store.permissions).toEqual([]);
    expect(store.initialized).toBe(false);
  });

  it('signOut should skip remote logout when token is missing', async () => {
    const store = useSessionStore();
    mockGetToken.mockReturnValue('');
    store.$patch({
      token: '',
      user: { userId: 10, userName: 'u10' },
      permissions: ['system:user:list'],
      initialized: true
    });

    await store.signOut();

    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
    expect(store.user).toBeNull();
  });

  it('refreshes unread messages only for an authenticated session', async () => {
    const store = useSessionStore();
    mockGetToken.mockReturnValue('message-token');
    mockGetUnreadMessageCount.mockResolvedValue({ data: 4 });

    await store.refreshUnreadMessageCount();

    expect(mockGetUnreadMessageCount).toHaveBeenCalledTimes(1);
    expect(store.unreadMessageCount).toBe(4);

    mockGetToken.mockReturnValue('');
    await store.refreshUnreadMessageCount();

    expect(mockGetUnreadMessageCount).toHaveBeenCalledTimes(1);
    expect(store.unreadMessageCount).toBe(0);
  });

  it('patchUser should merge when user exists and initialize when user is null', () => {
    const store = useSessionStore();

    store.$patch({
      user: { userId: 501, userName: 'origin', nickName: 'n1' }
    });
    store.patchUser({
      nickName: 'n2'
    });
    expect(store.user).toMatchObject({
      userId: 501,
      userName: 'origin',
      nickName: 'n2'
    });

    store.$patch({
      user: null
    });
    store.patchUser({
      userName: 'new-user'
    });
    expect(store.user).toMatchObject({
      userName: 'new-user'
    });
  });

  it('hasPermission should delegate to permission helper', () => {
    const store = useSessionStore();
    store.$patch({ permissions: ['system:dept:list'] });
    mockHasPermission.mockReturnValue(true);

    const result = store.hasPermission('system:dept:list');

    expect(result).toBe(true);
    expect(mockHasPermission).toHaveBeenCalledWith(['system:dept:list'], 'system:dept:list');
  });
});
