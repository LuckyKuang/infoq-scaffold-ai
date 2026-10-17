import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import FileSaver from 'file-saver';
import service, { download, isRelogin } from '@/utils/request';
import modal from '@/utils/modal';

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
    const confirmSpy = vi.spyOn(modal, 'confirm').mockResolvedValue(false);

    (service.defaults as { adapter: unknown }).adapter = async (config: InternalAxiosRequestConfig) =>
      createResponse(config, {
        code: 401,
        msg: 'unauthorized'
      });

    await expect(service.get('/secure')).rejects.toThrow('无效的会话');
    expect(confirmSpy).toHaveBeenCalledTimes(1);
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
