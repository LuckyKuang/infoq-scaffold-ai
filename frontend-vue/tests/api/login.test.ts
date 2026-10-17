const loginApiMocks = vi.hoisted(() => ({
  request: vi.fn()
}));

vi.mock('@/utils/request', () => ({
  default: loginApiMocks.request
}));

import {
  checkInviteCode,
  exchangeOAuthTicket,
  forgotPassword,
  getCodeImg,
  getInfo,
  getOAuthProviders,
  login,
  logout,
  register,
  sendEmailCode
} from '@/api/login';
import type { LoginData } from '@/api/types';

describe('api/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('sends login request with default clientId and grantType', () => {
    login({
      username: 'alice',
      password: '123456',
      code: 'abcd',
      uuid: 'uuid-1'
    } as unknown as LoginData);

    expect(loginApiMocks.request).toHaveBeenCalledWith({
      url: '/auth/login',
      headers: {
        isToken: false,
        isEncrypt: true,
        repeatSubmit: false
      },
      method: 'post',
      data: {
        username: 'alice',
        password: '123456',
        code: 'abcd',
        uuid: 'uuid-1',
        clientId: 'test-client-id',
        grantType: 'password'
      }
    });
  });

  it('keeps explicit login clientId and grantType when provided', () => {
    login({
      username: 'alice',
      password: '123456',
      code: 'abcd',
      uuid: 'uuid-1',
      clientId: 'custom-client',
      grantType: 'sms'
    } as LoginData);

    expect(loginApiMocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'custom-client',
          grantType: 'sms'
        })
      })
    );
  });

  it('requests enabled oauth providers through public endpoint', () => {
    getOAuthProviders();

    expect(loginApiMocks.request).toHaveBeenCalledWith({
      url: '/auth/oauth/providers',
      headers: {
        isToken: false
      },
      method: 'get'
    });
  });

  it('exchanges oauth ticket with encrypted public payload', () => {
    exchangeOAuthTicket({
      loginTicket: 'ticket-1'
    });

    expect(loginApiMocks.request).toHaveBeenCalledWith({
      url: '/auth/oauth/ticket',
      headers: {
        isToken: false,
        isEncrypt: true,
        repeatSubmit: false
      },
      method: 'post',
      data: {
        loginTicket: 'ticket-1',
        clientId: 'test-client-id',
        grantType: 'oauth'
      }
    });
  });

  it('sends register request with fixed clientId and password grant type', () => {
    register({
      email: 'user@example.com',
      emailCode: '999000',
      username: 'new-user',
      password: '123456',
      inviteCode: 'INVITE-CODE'
    });

    expect(loginApiMocks.request).toHaveBeenCalledWith({
      url: '/auth/register',
      headers: {
        isToken: false,
        isEncrypt: true,
        repeatSubmit: false
      },
      method: 'post',
      data: {
        email: 'user@example.com',
        emailCode: '999000',
        inviteCode: 'INVITE-CODE',
        username: 'new-user',
        password: '123456',
        clientId: 'test-client-id',
        grantType: 'password'
      }
    });
  });

  it('calls logout endpoint directly when sse flag is disabled', () => {
    vi.stubEnv('VITE_APP_SSE', 'false');

    logout();

    expect(loginApiMocks.request).toHaveBeenCalledTimes(1);
    expect(loginApiMocks.request).toHaveBeenCalledWith({
      url: '/auth/logout',
      method: 'post'
    });
  });

  it('closes sse stream before logout when sse flag is enabled', () => {
    vi.stubEnv('VITE_APP_SSE', 'true');

    logout();

    expect(loginApiMocks.request).toHaveBeenCalledTimes(2);
    expect(loginApiMocks.request).toHaveBeenNthCalledWith(1, {
      url: '/resource/sse/close',
      method: 'get'
    });
    expect(loginApiMocks.request).toHaveBeenNthCalledWith(2, {
      url: '/auth/logout',
      method: 'post'
    });
  });

  it('requests captcha and user info endpoints', () => {
    getCodeImg();
    getInfo();

    expect(loginApiMocks.request).toHaveBeenNthCalledWith(1, {
      url: '/auth/code',
      headers: {
        isToken: false
      },
      method: 'get',
      timeout: 20000
    });
    expect(loginApiMocks.request).toHaveBeenNthCalledWith(2, {
      url: '/system/user/getInfo',
      method: 'get'
    });
  });

  it('sends email verification code with scene-aware payload', () => {
    sendEmailCode({
      email: 'user@example.com',
      scene: 'forgot_password',
      inviteCode: 'INVITE-CODE',
      code: 'ABCD',
      uuid: 'uuid-2'
    });

    expect(loginApiMocks.request).toHaveBeenCalledWith({
      url: '/auth/email/code',
      headers: {
        isToken: false,
        isEncrypt: true,
        repeatSubmit: false
      },
      method: 'post',
      data: {
        email: 'user@example.com',
        scene: 'forgot_password',
        inviteCode: 'INVITE-CODE',
        code: 'ABCD',
        uuid: 'uuid-2'
      }
    });
  });

  it('checks invite code through public endpoint', () => {
    checkInviteCode('INVITE-CODE');

    expect(loginApiMocks.request).toHaveBeenCalledWith({
      url: '/auth/invite/code/check',
      headers: {
        isToken: false
      },
      method: 'get',
      params: {
        inviteCode: 'INVITE-CODE'
      }
    });
  });

  it('submits forgot-password request with encrypted public payload', () => {
    forgotPassword({
      email: 'user@example.com',
      emailCode: '888999',
      newPassword: 'Pass@123',
      confirmPassword: 'Pass@123',
      code: 'ABCD',
      uuid: 'uuid-3'
    });

    expect(loginApiMocks.request).toHaveBeenCalledWith({
      url: '/auth/forgot-password',
      headers: {
        isToken: false,
        isEncrypt: true,
        repeatSubmit: false
      },
      method: 'post',
      data: {
        email: 'user@example.com',
        emailCode: '888999',
        newPassword: 'Pass@123',
        confirmPassword: 'Pass@123',
        code: 'ABCD',
        uuid: 'uuid-3'
      }
    });
  });
});
