vi.mock('file-saver', () => ({
  default: {
    saveAs: vi.fn()
  }
}));

const requestMocks = vi.hoisted(() => ({
  logout: vi.fn(() => Promise.resolve()),
  router: {
    replace: vi.fn(),
    currentRoute: {
      value: {
        fullPath: '/system/user?tab=1'
      }
    }
  }
}));

vi.mock('@/store/modules/user', () => ({
  useUserStore: () => ({
    logout: requestMocks.logout
  })
}));

vi.mock('@/router', () => ({
  default: requestMocks.router
}));

vi.mock('@/utils/crypto', () => ({
  generateAesKey: vi.fn(() => 'aes-key-123'),
  encryptBase64: vi.fn((value: string) => `b64(${value})`),
  encryptWithAes: vi.fn((value: string, key: string) => `aes(${key})::${value}`),
  decryptBase64: vi.fn((value: string) => value.replace('b64(', '').replace(')', '')),
  decryptWithAes: vi.fn((value: string, key: string) => {
    if (value === 'cipher-data' && key === 'aes-key-123') {
      return '{"code":200,"msg":"ok","data":{"id":9}}';
    }
    return '{"code":200,"msg":"ok"}';
  })
}));

vi.mock('@/utils/jsencrypt', () => ({
  encrypt: vi.fn((value: string) => `rsa(${value})`),
  decrypt: vi.fn((value: string) => {
    if (value === 'encrypted-header') {
      return 'b64(aes-key-123)';
    }
    return value;
  })
}));

import service, { download, globalHeaders, isRelogin } from '@/utils/request';
import { removeToken, setToken } from '@/utils/auth';
import { HttpStatus } from '@/enums/RespEnum';
import FileSaver from 'file-saver';
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus/es';

type RequestConfig = {
  method: string;
  url: string;
  params?: Record<string, string>;
  headers: Record<string, unknown>;
  data?: unknown;
};

type ResponsePayload = {
  data: unknown;
  request: {
    responseType: string;
  };
  headers: Record<string, string>;
};

type InterceptorEntry<TInput, TOutput> = {
  fulfilled: (payload: TInput) => TOutput;
  rejected: (error: Error) => Promise<never>;
};

type InterceptorService = {
  interceptors: {
    request: {
      handlers: Array<InterceptorEntry<RequestConfig, Promise<RequestConfig> | RequestConfig>>;
    };
    response: {
      handlers: Array<InterceptorEntry<ResponsePayload, Promise<unknown> | unknown>>;
    };
  };
};

const interceptorService = service as unknown as InterceptorService;
const requestHandler = interceptorService.interceptors.request.handlers[0]!.fulfilled;
const requestErrorHandler = interceptorService.interceptors.request.handlers[0]!.rejected;
const responseHandler = interceptorService.interceptors.response.handlers[0]!.fulfilled;
const responseErrorHandler = interceptorService.interceptors.response.handlers[0]!.rejected;

const messageMock = ElMessage as unknown as ReturnType<typeof vi.fn> & {
  error: ReturnType<typeof vi.fn>;
};
const messageConfirmMock = ElMessageBox.confirm as unknown as ReturnType<typeof vi.fn>;
const notificationMock = ElNotification as unknown as {
  error: ReturnType<typeof vi.fn>;
};
const fileSaverMock = FileSaver as unknown as {
  saveAs: ReturnType<typeof vi.fn>;
};

describe('utils/request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    removeToken();
    window.sessionStorage.clear();
    isRelogin.show = false;
    requestMocks.router.currentRoute.value.fullPath = '/system/user?tab=1';
    requestMocks.logout.mockResolvedValue(undefined);
  });

  it('builds global headers with token', () => {
    setToken('token-x');
    expect(globalHeaders()).toEqual({
      Authorization: 'Bearer token-x',
      clientid: 'test-client-id'
    });
  });

  it('injects token and maps get params in request interceptor', async () => {
    setToken('token-1');
    const config = await requestHandler({
      method: 'get',
      url: '/system/user/list',
      params: { userName: 'alice', status: '0' },
      headers: {}
    });

    expect(config.headers.Authorization).toBe('Bearer token-1');
    expect(config.url).toContain('/system/user/list?');
    expect(config.url).toContain('userName=alice');
    expect(config.params).toEqual({});
  });

  it('blocks duplicate submit requests within interval', async () => {
    const config = {
      method: 'post',
      url: '/system/user',
      headers: {},
      data: { userName: 'alice' }
    } as RequestConfig;

    await requestHandler(config);
    await expect(requestHandler(config)).rejects.toThrow('数据正在处理，请勿重复提交');
  });

  it('updates repeat-submit cache when same request is sent after interval', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T00:00:00.000Z'));

    const config = {
      method: 'post',
      url: '/system/user',
      headers: {},
      data: { userName: 'alice' }
    } as RequestConfig;

    await requestHandler(config);
    const firstSessionObj = JSON.parse(window.sessionStorage.getItem('sessionObj') as string);

    vi.advanceTimersByTime(600);
    await requestHandler(config);
    const secondSessionObj = JSON.parse(window.sessionStorage.getItem('sessionObj') as string);

    expect(secondSessionObj.time).toBeGreaterThan(firstSessionObj.time);
    vi.useRealTimers();
  });

  it('skips token injection and strips content-type for form data', async () => {
    setToken('token-2');
    const formData = new FormData();
    formData.append('name', 'alice');

    const config = await requestHandler({
      method: 'post',
      url: '/system/upload',
      headers: {
        isToken: false,
        repeatSubmit: false,
        'Content-Type': 'multipart/form-data'
      },
      data: formData
    });

    expect(config.headers.Authorization).toBeUndefined();
    expect(config.headers['Content-Type']).toBeUndefined();
  });

  it('allows repeated posts when repeatSubmit header is false', async () => {
    const config = {
      method: 'post',
      url: '/system/user',
      headers: {
        repeatSubmit: false
      },
      data: { userName: 'alice' }
    } as RequestConfig;

    const first = requestHandler(config);
    const second = requestHandler(config);
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
  });

  it('encrypts payload when encryption is enabled', async () => {
    vi.stubEnv('VITE_APP_ENCRYPT', 'true');

    const config = await requestHandler({
      method: 'post',
      url: '/system/user',
      headers: {
        isEncrypt: 'true',
        repeatSubmit: false
      },
      data: { userName: 'alice' }
    });

    expect(config.headers['encrypt-key']).toBeTruthy();
    expect(typeof config.data).toBe('string');
  });

  it('rejects request interceptor errors as-is', async () => {
    const error = new Error('request-error');
    await expect(requestErrorHandler(error)).rejects.toBe(error);
  });

  it('passes response data when success code', () => {
    const response = {
      data: { code: HttpStatus.SUCCESS, data: { id: 1 } },
      request: { responseType: '' },
      headers: {}
    } as ResponsePayload;

    expect(responseHandler(response)).toEqual(response.data);
  });

  it('rejects missing response code and returns binary responses directly', async () => {
    const noCodeResp = {
      data: { data: { id: 2 } },
      request: { responseType: '' },
      headers: {}
    } as ResponsePayload;
    await expect(responseHandler(noCodeResp)).rejects.toThrow('缺少状态码 code');

    const blobData = { blob: true };
    const blobResp = {
      data: blobData,
      request: { responseType: 'blob' },
      headers: {}
    } as ResponsePayload;
    expect(await responseHandler(blobResp)).toBe(blobData);
  });

  it('rejects invalid code and malformed pagination payloads', async () => {
    const invalidCodeResp = {
      data: { code: '200', data: { id: 2 } },
      request: { responseType: '' },
      headers: {}
    } as ResponsePayload;

    await expect(responseHandler(invalidCodeResp)).rejects.toThrow('状态码 code 必须是有限数字');

    const missingTotalResp = {
      data: { code: HttpStatus.SUCCESS, rows: [] },
      request: { responseType: '' },
      headers: {}
    } as ResponsePayload;

    await expect(responseHandler(missingTotalResp)).rejects.toThrow('分页响应 total 必须是有限数字');
  });

  it('handles 401 relogin flow for confirm and cancel branches', async () => {
    const unauthorizedResp = {
      data: { code: 401, msg: 'expired' },
      request: { responseType: '' },
      headers: {}
    } as ResponsePayload;

    messageConfirmMock.mockResolvedValueOnce(true);
    await expect(responseHandler(unauthorizedResp)).rejects.toBe('无效的会话，或者会话已过期，请重新登录。');
    await Promise.resolve();
    await Promise.resolve();
    expect(requestMocks.logout).toHaveBeenCalledTimes(1);
    expect(requestMocks.router.replace).toHaveBeenCalledWith({
      path: '/login',
      query: {
        redirect: encodeURIComponent('/system/user?tab=1')
      }
    });
    expect(isRelogin.show).toBe(false);

    messageConfirmMock.mockRejectedValueOnce(new Error('cancel'));
    await expect(responseHandler(unauthorizedResp)).rejects.toBe('无效的会话，或者会话已过期，请重新登录。');
    await Promise.resolve();
    expect(requestMocks.logout).toHaveBeenCalledTimes(1);
    expect(isRelogin.show).toBe(false);

    isRelogin.show = true;
    await expect(responseHandler(unauthorizedResp)).rejects.toBe('无效的会话，或者会话已过期，请重新登录。');
    expect(ElMessageBox.confirm).toHaveBeenCalledTimes(2);
  });

  it('decrypts encrypted response payload when encrypt header is present', () => {
    vi.stubEnv('VITE_APP_ENCRYPT', 'true');
    const encryptedResp = {
      data: 'cipher-data',
      request: { responseType: '' },
      headers: {
        'encrypt-key': 'encrypted-header'
      }
    } as ResponsePayload;

    expect(responseHandler(encryptedResp)).toEqual({
      code: 200,
      msg: 'ok',
      data: {
        id: 9
      }
    });
  });

  it('rejects and notifies for warning and unknown code', async () => {
    const warnResp = {
      data: { code: HttpStatus.WARN, msg: 'warn-msg' },
      request: { responseType: '' },
      headers: {}
    } as ResponsePayload;

    await expect(responseHandler(warnResp)).rejects.toThrow('warn-msg');
    expect(messageMock).toHaveBeenCalled();

    const unknownResp = {
      data: { code: 999, msg: 'unknown' },
      request: { responseType: '' },
      headers: {}
    } as ResponsePayload;

    await expect(responseHandler(unknownResp)).rejects.toBe('error');
    expect(notificationMock.error).toHaveBeenCalled();
  });

  it('rejects and displays error message for server error code', async () => {
    const serverResp = {
      data: { code: HttpStatus.SERVER_ERROR, msg: 'server-error' },
      request: { responseType: '' },
      headers: {}
    } as ResponsePayload;

    await expect(responseHandler(serverResp)).rejects.toThrow('server-error');
    expect(messageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'server-error',
        type: 'error'
      })
    );
  });

  it('translates network error message in response reject handler', async () => {
    const error = new Error('Network Error');
    await expect(responseErrorHandler(error)).rejects.toBe(error);
    expect(messageMock).toHaveBeenCalledWith(expect.objectContaining({ message: '后端接口连接异常', type: 'error' }));
  });

  it('translates timeout and status code errors in response reject handler', async () => {
    const timeoutError = new Error('timeout of 5000ms exceeded');
    await expect(responseErrorHandler(timeoutError)).rejects.toBe(timeoutError);
    expect(messageMock).toHaveBeenCalledWith(expect.objectContaining({ message: '系统接口请求超时', type: 'error' }));

    const statusError = new Error('Request failed with status code 503');
    await expect(responseErrorHandler(statusError)).rejects.toBe(statusError);
    expect(messageMock).toHaveBeenCalledWith(expect.objectContaining({ message: '系统接口503异常', type: 'error' }));
  });

  it('downloads blob and handles json error payload', async () => {
    const postSpy = vi.spyOn(service, 'post');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    postSpy.mockResolvedValueOnce(new Blob(['file-content'], { type: 'application/octet-stream' }));
    await download('/export', { id: 1 }, 'users.xlsx');
    expect(fileSaverMock.saveAs).toHaveBeenCalled();
    const firstCallOptions = postSpy.mock.calls[0][2] as {
      transformRequest: Array<(params: unknown) => string>;
    };
    expect(firstCallOptions.transformRequest[0]({ id: 1, status: '0' })).toContain('id=1');

    postSpy.mockResolvedValueOnce(new Blob(['{"code":500,"msg":"fail"}'], { type: 'application/json' }));
    await download('/export', { id: 2 }, 'users.xlsx');
    expect(messageMock.error).toHaveBeenCalled();

    postSpy.mockRejectedValueOnce(new Error('boom'));
    await download('/export', { id: 3 }, 'users.xlsx');
    expect(messageMock.error).toHaveBeenCalledWith('下载文件出现错误，请联系管理员！');
    consoleErrorSpy.mockRestore();
  });

  it('parses json payload from mocked blob and resolves download error message', async () => {
    const postSpy = vi.spyOn(service, 'post');
    const OriginalBlob = globalThis.Blob;

    class MockBlob {
      async text() {
        return '{"code":500,"msg":"fail"}';
      }
    }

    Object.defineProperty(globalThis, 'Blob', {
      value: MockBlob,
      configurable: true
    });

    postSpy.mockResolvedValueOnce({
      type: 'application/json'
    } as unknown as Blob);
    await download('/export', { id: 4 }, 'users.xlsx');
    expect(messageMock.error).toHaveBeenCalled();

    Object.defineProperty(globalThis, 'Blob', {
      value: OriginalBlob,
      configurable: true
    });
  });
});
