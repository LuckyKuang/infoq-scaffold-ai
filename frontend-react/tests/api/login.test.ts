const loginApiMocks = vi.hoisted(() => ({
  request: vi.fn()
}));

vi.mock('@/utils/request', () => ({
  default: loginApiMocks.request
}));

describe('api/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('VITE_APP_CLIENT_ID', 'test-client-id');
    vi.stubEnv('VITE_APP_SSE', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends login request with default clientId and grantType', async () => {
    const { login } = await import('@/api/login');
    login({
      username: 'alice',
      password: '123456',
      code: 'abcd',
      uuid: 'uuid-1'
    } as never);

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

  it('keeps explicit login clientId and grantType when provided', async () => {
    const { login } = await import('@/api/login');
    login({
      username: 'alice',
      password: '123456',
      code: 'abcd',
      uuid: 'uuid-1',
      clientId: 'custom-client',
      grantType: 'sms'
    });

    expect(loginApiMocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'custom-client',
          grantType: 'sms'
        })
      })
    );
  });

  it('requests enabled oauth providers through public endpoint', async () => {
    const { getOAuthProviders } = await import('@/api/login');
    getOAuthProviders();

    expect(loginApiMocks.request).toHaveBeenCalledWith({
      url: '/auth/oauth/providers',
      headers: {
        isToken: false
      },
      method: 'get'
    });
  });

  it('exchanges oauth ticket with encrypted public payload', async () => {
    const { exchangeOAuthTicket } = await import('@/api/login');
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

  it('sends register request with fixed clientId and password grant type', async () => {
    const { register } = await import('@/api/login');
    register({
      email: 'user@example.com',
      emailCode: '999000',
      inviteCode: 'INVITE-CODE',
      username: 'new-user',
      password: 'Pass@123'
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
        password: 'Pass@123',
        clientId: 'test-client-id',
        grantType: 'password'
      }
    });
  });

  it('sends scene-aware email verification code', async () => {
    const { sendEmailCode } = await import('@/api/login');
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

  it('checks invite code through public endpoint', async () => {
    const { checkInviteCode } = await import('@/api/login');
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

  it('submits forgot-password request with encrypted public payload', async () => {
    const { forgotPassword } = await import('@/api/login');
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

  it('requests captcha and user info endpoints', async () => {
    const { getCodeImg, getInfo } = await import('@/api/login');
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

  it('closes sse stream before logout when sse flag is enabled', async () => {
    vi.stubEnv('VITE_APP_SSE', 'true');
    const { logout } = await import('@/api/login');

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
});
