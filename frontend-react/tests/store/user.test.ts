import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResponse, LoginData, LoginResult } from '@/api/types';
import { getToken, setToken } from '@/utils/auth';

const userStoreMocks = vi.hoisted(() => ({
  login: vi.fn(),
  exchangeOAuthTicket: vi.fn(),
  logout: vi.fn(() => Promise.resolve()),
  getInfo: vi.fn(),
  initSSE: vi.fn(),
  closeSSE: vi.fn(),
  initWebSocket: vi.fn(),
  closeWebSocket: vi.fn()
}));

vi.mock('@/api/login', () => ({
  login: userStoreMocks.login,
  exchangeOAuthTicket: userStoreMocks.exchangeOAuthTicket,
  logout: userStoreMocks.logout,
  getInfo: userStoreMocks.getInfo
}));

vi.mock('@/utils/sse', () => ({
  initSSE: userStoreMocks.initSSE,
  closeSSE: userStoreMocks.closeSSE
}));

vi.mock('@/utils/websocket', () => ({
  initWebSocket: userStoreMocks.initWebSocket,
  closeWebSocket: userStoreMocks.closeWebSocket
}));

const { useUserStore } = await import('@/store/modules/user');

describe('store/user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubEnv('VITE_APP_BASE_API', '/test-api');
    useUserStore.setState({
      token: '',
      roles: [],
      permissions: [],
      name: '',
      nickname: '',
      avatar: '',
      userId: ''
    });
  });

  it('login success should update token and initialize realtime channels', async () => {
    userStoreMocks.login.mockResolvedValue({ data: { access_token: 'token-1' } } as ApiResponse<LoginResult>);

    await useUserStore.getState().login({ username: 'admin', password: '123456', code: '', uuid: '' } as LoginData);

    expect(useUserStore.getState().token).toBe('token-1');
    expect(getToken()).toBe('token-1');
    expect(userStoreMocks.initSSE).toHaveBeenCalledWith('/test-api/resource/sse');
    expect(userStoreMocks.initWebSocket).toHaveBeenCalledWith('ws://localhost:3000/test-api/resource/websocket');
  });

  it('oauth ticket login should exchange ticket and update token through same session path', async () => {
    userStoreMocks.exchangeOAuthTicket.mockResolvedValue({ data: { access_token: 'oauth-token' } } as ApiResponse<LoginResult>);

    await useUserStore.getState().loginByOAuthTicket('ticket-1');

    expect(userStoreMocks.exchangeOAuthTicket).toHaveBeenCalledWith({ loginTicket: 'ticket-1' });
    expect(useUserStore.getState().token).toBe('oauth-token');
    expect(getToken()).toBe('oauth-token');
    expect(userStoreMocks.initSSE).toHaveBeenCalledWith('/test-api/resource/sse');
    expect(userStoreMocks.initWebSocket).toHaveBeenCalledWith('ws://localhost:3000/test-api/resource/websocket');
  });

  it('restores realtime channels when a persisted token is bootstrapped after refresh', () => {
    setToken('persisted-token');
    useUserStore.setState({
      token: 'persisted-token'
    });

    useUserStore.getState().initializeRealtimeChannels();

    expect(userStoreMocks.initSSE).toHaveBeenCalledWith('/test-api/resource/sse');
    expect(userStoreMocks.initWebSocket).toHaveBeenCalledWith('ws://localhost:3000/test-api/resource/websocket');
  });

  it('logout should clear local session when logout api fails', async () => {
    const error = new Error('logout unauthorized');
    userStoreMocks.logout.mockRejectedValueOnce(error);
    setToken('expired-token');
    useUserStore.setState({
      token: 'expired-token',
      roles: ['admin'],
      permissions: ['system:user:list'],
      name: 'admin',
      nickname: 'Admin',
      avatar: 'avatar.png',
      userId: 1
    });

    await expect(useUserStore.getState().logout()).rejects.toThrow('logout unauthorized');

    expect(userStoreMocks.closeSSE).toHaveBeenCalled();
    expect(userStoreMocks.closeWebSocket).toHaveBeenCalled();
    expect(userStoreMocks.logout).toHaveBeenCalled();
    expect(getToken()).toBe('');
    expect(useUserStore.getState()).toMatchObject({
      token: '',
      roles: [],
      permissions: [],
      name: '',
      nickname: '',
      avatar: '',
      userId: ''
    });
  });
});
