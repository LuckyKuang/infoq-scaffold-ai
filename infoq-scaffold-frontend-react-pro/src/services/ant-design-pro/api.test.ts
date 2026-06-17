import {beforeEach, describe, expect, it, vi} from 'vitest';
import {login} from './api';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  request: mocks.request,
}));

describe('ant-design-pro api service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.request.mockResolvedValue({
      code: 200,
      data: { access_token: 'token-1' },
    });
  });

  it('should send only backend supported password login fields', async () => {
    await login({
      username: 'admin',
      password: 'admin123',
      rememberMe: true,
      code: 'abcd',
      uuid: 'captcha-uuid',
      clientId: 'pc-client',
      autoLogin: true,
      source: 'account',
      type: 'account',
    } as API.LoginParams & Record<string, unknown>);

    expect(mocks.request).toHaveBeenCalledWith(
      '/auth/login',
      expect.objectContaining({
        method: 'POST',
        data: {
          username: 'admin',
          password: 'admin123',
          rememberMe: true,
          code: 'abcd',
          uuid: 'captcha-uuid',
          clientId: 'pc-client',
          grantType: 'password',
        },
      }),
    );
    const requestOptions = mocks.request.mock.calls[0][1];
    expect(requestOptions.data).not.toHaveProperty('autoLogin');
    expect(requestOptions.data).not.toHaveProperty('source');
    expect(requestOptions.data).not.toHaveProperty('type');
  });
});
