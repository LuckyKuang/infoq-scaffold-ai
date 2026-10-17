import { createPinia, setActivePinia } from 'pinia';
import { useUserStore } from '@/store/modules/user';
import { getToken, setToken } from '@/utils/auth';
import type { ApiResponse, LoginData, LoginResult } from '@/api/types';
import type { UserInfo } from '@/api/system/user/types';

vi.mock('@/api/login', () => ({
  login: vi.fn(),
  exchangeOAuthTicket: vi.fn(),
  logout: vi.fn(() => Promise.resolve()),
  getInfo: vi.fn()
}));

vi.mock('@/utils/sse', () => ({
  initSSE: vi.fn(),
  closeSSE: vi.fn()
}));

const { login, exchangeOAuthTicket, getInfo, logout } = await import('@/api/login');
const { initSSE, closeSSE } = await import('@/utils/sse');

describe('store/user', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
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
    expect(logout).toHaveBeenCalled();
    expect(store.token).toBe('');
    expect(store.roles).toEqual([]);
    expect(store.permissions).toEqual([]);
  });

  it('logout should clear local session when logout api fails', async () => {
    vi.mocked(logout).mockRejectedValueOnce(new Error('logout unauthorized'));
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
    expect(logout).toHaveBeenCalled();
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
});
