import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import FileSaver from 'file-saver';
import service, { download, isRelogin } from '@/utils/request';
import modal from '@/utils/modal';
import { getToken, removeToken, setToken } from '@/utils/auth';
import { useUserStore } from '@/store/modules/user';
import { setNavigator } from '@/utils/router-utils';

const createResponse = (config: InternalAxiosRequestConfig, data: unknown, headers: Record<string, string> = {}): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers,
  config,
  request: {
    responseType: config.responseType
  }
});

describe('utils/request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeToken();
    vi.stubEnv('VITE_APP_ENCRYPT', 'true');
    vi.stubEnv('VITE_APP_CLIENT_ID', 'test-client');
    localStorage.clear();
    sessionStorage.clear();
    isRelogin.show = false;
  });

  it('handles success response', async () => {
    let capturedConfig: InternalAxiosRequestConfig | null = null;
    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) =>
      createResponse((capturedConfig = config), {
        code: 200,
        data: {
          ok: true
        }
      });

    const res = (await service.get('/demo', { params: { a: 1 } })) as { code: number; data: { ok: boolean } };
    expect(res.code).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(capturedConfig?.headers.clientid).toBe('test-client');
  });

  it('rejects malformed api and pagination responses', async () => {
    const msgErrorSpy = vi.spyOn(modal, 'msgError').mockImplementation(() => undefined as ReturnType<typeof modal.msgError>);

    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) =>
      createResponse(config, {
        data: {
          ok: true
        }
      });

    await expect(service.get('/missing-code')).rejects.toThrow('缺少状态码 code');

    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) =>
      createResponse(config, {
        code: '200',
        data: {
          ok: true
        }
      });

    await expect(service.get('/invalid-code')).rejects.toThrow('状态码 code 必须是有限数字');

    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) =>
      createResponse(config, {
        code: 200,
        rows: []
      });

    await expect(service.get('/missing-total')).rejects.toThrow('分页响应 total 必须是有限数字');
    expect(msgErrorSpy).toHaveBeenCalledTimes(3);
  });

  it('handles 401 response and triggers relogin modal', async () => {
    setToken('revoked-token');
    useUserStore.setState({ token: 'revoked-token', sessionState: 'authenticated', bootstrapReady: true });
    const confirmSpy = vi.spyOn(modal, 'confirm').mockResolvedValue(false);

    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) =>
      createResponse(config, {
        code: 401,
        msg: 'unauthorized'
      });

    await expect(service.get('/secure')).rejects.toThrow('无效的会话');
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(getToken()).toBe('');
    expect(useUserStore.getState().sessionState).toBe('anonymous');
  });

  it('does not restart session/logout handling for a failed new-bearer cleanup', async () => {
    const confirmSpy = vi.spyOn(modal, 'confirm');
    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) => createResponse(config, { code: 401 });
    await expect(
      service.post('/auth/logout', undefined, {
        headers: { skipRelogin: true, isToken: false, repeatSubmit: false, Authorization: 'Bearer unbound-token' }
      })
    ).rejects.toThrow('撤销未获确认');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('sessionObj')).toBeNull();
  });

  it.each(['business', 'http'])('rejects an old request late %s 401 without invalidating the newer login', async (kind) => {
    const confirmSpy = vi.spyOn(modal, 'confirm');
    vi.spyOn(modal, 'msgError').mockImplementation(() => undefined as ReturnType<typeof modal.msgError>);
    let finish!: () => void;
    setToken('old-token');
    service.defaults.adapter = (config) =>
      new Promise((resolve, reject) => {
        expect(config.headers.Authorization).toBe('Bearer old-token');
        finish = () => {
          const response = createResponse(config, { code: 401 });
          if (kind === 'business') resolve(response);
          else reject(new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, undefined, { ...response, status: 401 }));
        };
      });
    const pending = service.get('/old-session');
    const rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    setToken('new-token');
    useUserStore.setState({ token: 'new-token', sessionState: 'authenticated', bootstrapReady: true });
    finish();
    await rejected;
    expect(getToken()).toBe('new-token');
    expect(useUserStore.getState()).toMatchObject({ token: 'new-token', sessionState: 'authenticated' });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('does not invalidate the current login for a public request 401 without bearer', async () => {
    const confirmSpy = vi.spyOn(modal, 'confirm');
    setToken('current-token');
    service.defaults.adapter = async (config) => {
      expect(config.headers.Authorization).toBeUndefined();
      return createResponse(config, { code: 401 });
    };
    await expect(service.get('/auth/public', { headers: { isToken: false } })).rejects.toThrow('无效的会话');
    expect(getToken()).toBe('current-token');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('invalidates a current bearer on an HTTP 401', async () => {
    vi.spyOn(modal, 'msgError').mockImplementation(() => undefined as ReturnType<typeof modal.msgError>);
    setToken('current-token');
    service.defaults.adapter = async (config) => {
      throw new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, undefined, {
        ...createResponse(config, { code: 401 }),
        status: 401
      });
    };
    await expect(service.get('/current-session')).rejects.toThrow('status code 401');
    expect(getToken()).toBe('');
    expect(useUserStore.getState().sessionState).toBe('anonymous');
  });

  it('does not navigate a newly authenticated user when an old relogin dialog completes', async () => {
    let confirm!: (accepted: boolean) => void;
    vi.spyOn(modal, 'confirm').mockImplementation(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        })
    );
    const navigate = vi.fn();
    setNavigator(navigate);
    setToken('expired-token');
    service.defaults.adapter = async (config) => createResponse(config, { code: 401 });
    await expect(service.get('/expired-session')).rejects.toThrow('无效的会话');
    setToken('new-token');
    confirm(true);
    await Promise.resolve();
    expect(navigate).not.toHaveBeenCalled();
    expect(getToken()).toBe('new-token');
    setNavigator(() => {});
  });

  it('encrypts payload when header requires encryption', async () => {
    let capturedConfig: InternalAxiosRequestConfig | null = null;

    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) => {
      capturedConfig = config;
      return createResponse(config, { code: 200, data: {} });
    };

    await service.post(
      '/secure',
      {
        name: 'admin'
      },
      {
        headers: {
          isEncrypt: 'true',
          repeatSubmit: false
        }
      }
    );

    expect(capturedConfig).toBeTruthy();
    expect(capturedConfig?.headers['encrypt-key']).toBeTruthy();
    expect(typeof capturedConfig?.data).toBe('string');
  });

  it.each(['/auth/login', '/auth/oauth/ticket'])('does not persist credential request data for %s', async (url) => {
    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) =>
      createResponse(config, { code: 200, data: {} });
    await service.post(
      url,
      { password: 'test-only-password', loginTicket: 'one-use-fixture' },
      { headers: { isToken: false, repeatSubmit: false, isEncrypt: 'true' } }
    );
    expect(sessionStorage.getItem('sessionObj')).toBeNull();
    expect(localStorage.getItem('password')).toBeNull();
  });

  it('downloads blob and saves as file', async () => {
    const saveAsSpy = vi.spyOn(FileSaver, 'saveAs').mockImplementation(() => undefined);

    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) =>
      createResponse(config, new Blob(['hello'], { type: 'application/octet-stream' }));

    await download('/download', { id: 1 }, 'hello.txt');
    expect(saveAsSpy).toHaveBeenCalledTimes(1);
  });

  it('reports download error for json blob', async () => {
    const msgErrorSpy = vi.spyOn(modal, 'msgError').mockImplementation(() => undefined as ReturnType<typeof modal.msgError>);

    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) =>
      createResponse(config, new Blob([JSON.stringify({ code: 500, msg: 'fail' })], { type: 'application/json' }));

    await download('/download', { id: 1 }, 'failed.txt');
    expect(msgErrorSpy).toHaveBeenCalled();
  });
});
