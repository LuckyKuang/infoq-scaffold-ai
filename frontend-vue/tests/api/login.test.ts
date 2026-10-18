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
  bindBrowserSession,
  restoreBrowserSession,
  deleteBrowserSession,
  clearBrowserSessionCsrf,
  getBrowserSessionCsrf,
  register,
  sendEmailCode
} from '@/api/login';
import type { LoginData } from '@/api/types';
import { CookieJar } from 'jsdom';

describe('api/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    clearBrowserSessionCsrf();
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

  it('revokes a failed new login through its explicit Bearer without relogin interceptors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 200 }) });
    vi.stubGlobal('fetch', fetchMock);
    await logout('new-token');
    expect(fetchMock).toHaveBeenCalledWith(
      '/test-api/auth/logout',
      expect.objectContaining({ method: 'POST', headers: { clientid: 'test-client-id', Authorization: 'Bearer new-token' } })
    );
    expect(loginApiMocks.request).not.toHaveBeenCalled();
  });

  it('bootstraps CSRF once and sends only PUT with an explicit Bearer', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 200, data: { token: 'csrf-fixture', headerName: 'X-XSRF-TOKEN' } })
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200 }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 200, data: { access_token: 'restored', client_id: 'test-client-id', expire_in: 123 } })
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200 }) });
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([getBrowserSessionCsrf(), getBrowserSessionCsrf()]);
    await bindBrowserSession('new-token');
    await expect(restoreBrowserSession()).resolves.toMatchObject({ access_token: 'restored' });
    await deleteBrowserSession();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const [get, put, post, del] = fetchMock.mock.calls;
    expect(get[0]).toBe('/test-api/auth/browser-session/csrf');
    expect(get[1].headers).toEqual({ clientid: 'test-client-id', 'X-InfoQ-Browser-Session': 'vue' });
    expect(put[1].headers.Authorization).toBe('Bearer new-token');
    for (const call of [post, del]) {
      expect(call[1].headers.Authorization).toBeUndefined();
      expect(call[1].headers['X-XSRF-TOKEN']).toBe('csrf-fixture');
    }
    expect(del[1].method).toBe('DELETE');
    expect(loginApiMocks.request).not.toHaveBeenCalled();
  });

  it.each([401, 403, 503])('rejects non-JSON error HTTP %s as a protocol failure', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => {
          throw new Error('not json');
        }
      })
    );
    await expect(restoreBrowserSession()).rejects.toMatchObject({ status: 502 });
  });

  it('rejects a malformed or different-client restore response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }) })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ code: 200, data: { access_token: 'token', client_id: 'another-client', expire_in: 2 } })
        })
    );
    await expect(restoreBrowserSession()).rejects.toThrow('恢复响应契约错误');
  });

  it('rejects cross-origin API prefixes before sending a new token or restoration request', async () => {
    vi.stubEnv('VITE_APP_BASE_API', 'https://different.example/api');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(bindBrowserSession('new-token')).rejects.toThrow('同源 API 前缀');
    await expect(logout('new-token')).rejects.toThrow('同源 API 前缀');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 503])('preserves an explicit POST restore HTTP %s error', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200, data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }) })
        .mockResolvedValueOnce({ ok: false, status, json: async () => ({ code: status }) })
    );
    await expect(restoreBrowserSession()).rejects.toMatchObject({ status, method: 'POST' });
  });

  it('rejects a 200 HTTP response that claims an anonymous status in its payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 401 }) }));
    await expect(restoreBrowserSession()).rejects.toMatchObject({ status: 502 });
  });

  it('finishes DELETE and obtains new CSRF before a later PUT can set the next cookie', async () => {
    let finishDelete!: (value: unknown) => void;
    const deleting = new Promise((resolve) => {
      finishDelete = resolve;
    });
    const csrfResponse = { ok: true, status: 200, json: async () => ({ code: 200, data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }) };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(csrfResponse)
      .mockReturnValueOnce(deleting)
      .mockResolvedValueOnce(csrfResponse)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 200 }) });
    vi.stubGlobal('fetch', fetchMock);
    const exiting = deleteBrowserSession();
    const entering = bindBrowserSession('next-token');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['GET', 'DELETE']);
    finishDelete({ ok: true, status: 200, json: async () => ({ code: 200 }) });
    await Promise.all([exiting, entering]);
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['GET', 'DELETE', 'GET', 'PUT']);
  });

  it.each([false, true])('renews a server-cleared CSRF cookie after restore 401 before binding (queued=%s)', async (queued) => {
    const jar = new CookieJar();
    const resourceUrl = 'https://app.infoq.test/test-api/auth/browser-session';
    const cookieAttributes = 'Path=/test-api/auth/browser-session; HttpOnly; Secure; SameSite=Strict';
    jar.setCookieSync(`recovery=expired-fixture-session; ${cookieAttributes}`, resourceUrl);
    let issuedCsrfCount = 0;
    const clearedCookieStates: string[] = [];
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const headers = options.headers as Record<string, string>;
      expect(options.credentials).toBe('same-origin');
      if (options.method === 'GET') {
        const token = `fixture-csrf-${++issuedCsrfCount}`;
        jar.setCookieSync(`csrf=${token}; ${cookieAttributes}`, resourceUrl);
        return { ok: true, status: 200, json: async () => ({ code: 200, data: { token, headerName: 'X-XSRF-TOKEN' } }) };
      }
      if (options.method === 'POST') {
        expect(headers['X-XSRF-TOKEN']).toBe(jar.getCookiesSync(resourceUrl).find((cookie) => cookie.key === 'csrf')?.value);
        jar.setCookieSync(`csrf=; Max-Age=0; ${cookieAttributes}`, resourceUrl);
        jar.setCookieSync(`recovery=; Max-Age=0; ${cookieAttributes}`, resourceUrl);
        clearedCookieStates.push(jar.getCookieStringSync(resourceUrl));
        return { ok: false, status: 401, json: async () => ({ code: 401 }) };
      }
      if (options.method === 'PUT') {
        const csrfCookie = jar.getCookiesSync(resourceUrl).find((cookie) => cookie.key === 'csrf');
        const accepted = Boolean(csrfCookie && headers['X-XSRF-TOKEN'] === csrfCookie.value);
        if (accepted) jar.setCookieSync(`recovery=next-fixture-session; ${cookieAttributes}`, resourceUrl);
        return { ok: accepted, status: accepted ? 200 : 403, json: async () => ({ code: accepted ? 200 : 403 }) };
      }
      throw new Error('unexpected fixture operation');
    });
    vi.stubGlobal('fetch', fetchMock);
    const restoring = expect(restoreBrowserSession()).rejects.toMatchObject({ status: 401, method: 'POST' });
    const binding = queued ? bindBrowserSession('next-fixture-token') : undefined;
    await restoring;
    await expect(binding ?? bindBrowserSession('next-fixture-token')).resolves.toBeUndefined();
    expect(clearedCookieStates).toEqual(['']);
    expect(jar.getCookiesSync(resourceUrl).map(({ key, value }) => [key, value])).toEqual([
      ['csrf', 'fixture-csrf-2'],
      ['recovery', 'next-fixture-session']
    ]);
    expect(jar.getCookieStringSync(resourceUrl, { http: false })).toBe('');
    expect(issuedCsrfCount).toBe(2);
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['GET', 'POST', 'GET', 'PUT']);
  });

  it.each([403, 503])('keeps the valid CSRF cookie and cache after restore %s without retrying', async (status) => {
    const cookies = { csrf: 'fixture-valid-csrf', recovery: 'fixture-valid-session' };
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const headers = options.headers as Record<string, string>;
      if (options.method === 'GET') {
        return { ok: true, status: 200, json: async () => ({ code: 200, data: { token: cookies.csrf, headerName: 'X-XSRF-TOKEN' } }) };
      }
      expect(headers['X-XSRF-TOKEN']).toBe(cookies.csrf);
      if (options.method === 'POST') return { ok: false, status, json: async () => ({ code: status }) };
      if (options.method === 'PUT') return { ok: true, status: 200, json: async () => ({ code: 200 }) };
      throw new Error('unexpected fixture operation');
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(restoreBrowserSession()).rejects.toMatchObject({ status, method: 'POST' });
    await expect(bindBrowserSession('next-fixture-token')).resolves.toBeUndefined();
    expect(cookies).toEqual({ csrf: 'fixture-valid-csrf', recovery: 'fixture-valid-session' });
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['GET', 'POST', 'PUT']);
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
