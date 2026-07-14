import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useSessionStore} from '../../src/store/session';
import type {UserVO} from '../../src/api/types';

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
    useSessionStore.setState({ token: '', user: null, permissions: [], initialized: false, unreadMessageCount: 0 });

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
    mockGetToken.mockReturnValue('');

    const result = await useSessionStore.getState().loadSession();

    expect(result).toBeNull();
    expect(useSessionStore.getState().initialized).toBe(true);
    expect(useSessionStore.getState().token).toBe('');
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('loadSession should reuse cached state when initialized and force=false', async () => {
    mockGetToken.mockReturnValue('cached-token');
    useSessionStore.setState({
      token: 'cached-token',
      user: { userId: 1, userName: 'cached-user' },
      permissions: ['system:user:list'],
      initialized: true
    });

    const result = await useSessionStore.getState().loadSession();

    expect(mockGetInfo).not.toHaveBeenCalled();
    expect(result?.user.userName).toBe('cached-user');
    expect(result?.permissions).toEqual(['system:user:list']);
  });

  it('signIn should persist token and user info', async () => {
    mockLogin.mockResolvedValue({ data: { access_token: 'token-1' } });
    mockGetInfo.mockResolvedValue({
      data: {
        user: { userId: 100, userName: 'tester' },
        roles: [],
        permissions: ['*:*:*']
      }
    });
    mockNormalizePermissions.mockReturnValue(['system:user:list', 'monitor:online:list']);

    await useSessionStore.getState().signIn({ username: 'tester', password: 'pwd' });

    expect(mockSetToken).toHaveBeenCalledWith('token-1');
    expect(useSessionStore.getState().token).toBe('token-1');
    expect(useSessionStore.getState().user?.userName).toBe('tester');
    expect(useSessionStore.getState().permissions).toEqual(['system:user:list', 'monitor:online:list']);
    expect(useSessionStore.getState().initialized).toBe(true);
  });

  it('signIn should reject when backend omits permissions', async () => {
    mockLogin.mockResolvedValue({ data: { access_token: 'token-4' } });
    mockGetInfo.mockResolvedValue({
      data: {
        user: { userId: 101, userName: 'tester2' },
        roles: [],
        permissions: undefined
      }
    });
    await expect(useSessionStore.getState().signIn({ username: 'tester2', password: 'pwd2' })).rejects.toThrow('用户权限必须是字符串数组');

    expect(mockNormalizePermissions).not.toHaveBeenCalled();
    expect(useSessionStore.getState().permissions).toEqual([]);
  });

  it('signOut should clear state even when remote logout fails', async () => {
    mockGetToken.mockReturnValue('token-2');
    mockLogout.mockRejectedValue(new Error('logout failed'));
    useSessionStore.setState({
      token: 'token-2',
      user: { userId: 2, userName: 'u2' },
      permissions: ['system:user:list'],
      initialized: true
    });

    await expect(useSessionStore.getState().signOut()).rejects.toThrow('logout failed');

    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().token).toBe('');
    expect(useSessionStore.getState().user).toBeNull();
    expect(useSessionStore.getState().permissions).toEqual([]);
    expect(useSessionStore.getState().initialized).toBe(true);
  });

  it('signOut should call remote logout when token exists and clear state', async () => {
    mockGetToken.mockReturnValue('token-3');
    mockLogout.mockResolvedValue(undefined);
    useSessionStore.setState({
      token: 'token-3',
      user: { userId: 3, userName: 'u3' },
      permissions: ['system:user:list'],
      initialized: true
    });

    await useSessionStore.getState().signOut();

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().token).toBe('');
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('loadSession(force=true) should refresh user info even when initialized', async () => {
    mockGetToken.mockReturnValue('force-token');
    mockGetInfo.mockResolvedValue({
      data: {
        user: { userId: 300, userName: 'forced' },
        roles: [],
        permissions: ['system:dept:list']
      }
    });
    useSessionStore.setState({
      token: 'force-token',
      user: { userId: 200, userName: 'cached' },
      permissions: ['system:user:list'],
      initialized: true
    });

    const result = await useSessionStore.getState().loadSession(true);

    expect(mockGetInfo).toHaveBeenCalledTimes(1);
    expect(result?.user.userName).toBe('forced');
    expect(useSessionStore.getState().user?.userName).toBe('forced');
  });

  it('loadSession should reject when backend omits permissions', async () => {
    mockGetToken.mockReturnValue('token-5');
    mockGetInfo.mockResolvedValue({
      data: {
        user: { userId: 500, userName: 'no-perm' },
        roles: [],
        permissions: undefined
      }
    });
    await expect(useSessionStore.getState().loadSession(true)).rejects.toThrow('用户权限必须是字符串数组');

    expect(mockNormalizePermissions).not.toHaveBeenCalled();
    expect(useSessionStore.getState().permissions).toEqual([]);
  });

  it('signOut should skip remote logout when token is missing', async () => {
    mockGetToken.mockReturnValue('');
    useSessionStore.setState({
      token: '',
      user: { userId: 10, userName: 'u10' },
      permissions: ['system:user:list'],
      initialized: true
    });

    await useSessionStore.getState().signOut();

    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('refreshes unread messages only for an authenticated session', async () => {
    mockGetToken.mockReturnValue('message-token');
    mockGetUnreadMessageCount.mockResolvedValue({ data: 4 });

    await useSessionStore.getState().refreshUnreadMessageCount();

    expect(mockGetUnreadMessageCount).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().unreadMessageCount).toBe(4);

    mockGetToken.mockReturnValue('');
    await useSessionStore.getState().refreshUnreadMessageCount();

    expect(mockGetUnreadMessageCount).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().unreadMessageCount).toBe(0);
  });

  it('patchUser should merge when user exists and initialize when user is null', () => {
    const originUser: UserVO = { userId: 501, userName: 'origin', nickName: 'n1' };
    useSessionStore.setState({
      user: originUser
    });
    useSessionStore.getState().patchUser({
      nickName: 'n2'
    });
    expect(useSessionStore.getState().user).toMatchObject({
      userId: 501,
      userName: 'origin',
      nickName: 'n2'
    });

    useSessionStore.setState({
      user: null
    });
    useSessionStore.getState().patchUser({
      userName: 'new-user'
    });
    expect(useSessionStore.getState().user).toMatchObject({
      userName: 'new-user'
    });
  });

  it('hasPermission should delegate to permission helper', () => {
    useSessionStore.setState({ permissions: ['system:dept:list'] });
    mockHasPermission.mockReturnValue(true);

    const result = useSessionStore.getState().hasPermission('system:dept:list');

    expect(result).toBe(true);
    expect(mockHasPermission).toHaveBeenCalledWith(['system:dept:list'], 'system:dept:list');
  });
});
