import {describe, expect, it, vi} from 'vitest';

type SetupOptions = {
  token?: string;
  mobileEnv?: Partial<{
    baseApi: string;
    miniBaseApi: string;
    apiOrigin: string;
    encrypt: boolean;
    clientId: string;
    taroEnv: string;
  }>;
  rsaEncryptReturn?: string | false;
  rsaDecryptReturn?: string | false;
};

const setupRequestModule = async (options: SetupOptions = {}) => {
  vi.resetModules();

  const requestMock = vi.fn();
  const uploadFileMock = vi.fn();
  const getTokenMock = vi.fn(() => options.token ?? 'token-1');
  const removeTokenMock = vi.fn();

  const mobileEnv = {
    baseApi: '/dev-api',
    miniBaseApi: '/mini-api',
    apiOrigin: 'https://api.example.com/',
    encrypt: false,
    clientId: 'client-id',
    taroEnv: 'weapp',
    ...options.mobileEnv
  };

  const encryptMock = vi.fn(() => options.rsaEncryptReturn ?? 'rsa-encrypted-key');
  const decryptMock = vi.fn(() => options.rsaDecryptReturn ?? 'base64-aes-key');
  const generateAesKeyMock = vi.fn(() => 'generated-aes-key');
  const encryptBase64Mock = vi.fn((value: string) => `b64:${value}`);
  const decryptBase64Mock = vi.fn(() => 'decoded-aes-key');
  const encryptWithAesMock = vi.fn((value: string) => `enc:${value}`);
  const decryptWithAesMock = vi.fn(() => '{"code":200,"data":{"ok":true}}');

  const runtime = globalThis as { uni?: Record<string, unknown> };
  runtime.uni = {
    ...(runtime.uni || {}),
    request: requestMock,
    uploadFile: uploadFileMock
  };

  vi.doMock('../../src/utils/auth', () => ({
    getToken: getTokenMock,
    removeToken: removeTokenMock
  }));

  vi.doMock('../../src/utils/env', () => ({
    mobileEnv
  }));

  vi.doMock('../../src/utils/crypto', () => ({
    decryptBase64: decryptBase64Mock,
    decryptWithAes: decryptWithAesMock,
    encryptBase64: encryptBase64Mock,
    encryptWithAes: encryptWithAesMock,
    generateAesKey: generateAesKeyMock
  }));

  vi.doMock('../../src/utils/rsa', () => ({
    decrypt: decryptMock,
    encrypt: encryptMock
  }));

  const requestModule = await import('../../src/api/request');
  const errorsModule = await import('../../src/utils/errors');

  return {
    request: requestModule.request,
    uploadFile: requestModule.uploadFile,
    AppError: errorsModule.AppError,
    AuthError: errorsModule.AuthError,
    mocks: {
      requestMock,
      uploadFileMock,
      getTokenMock,
      removeTokenMock,
      encryptMock,
      decryptMock,
      generateAesKeyMock,
      encryptBase64Mock,
      decryptBase64Mock,
      encryptWithAesMock,
      decryptWithAesMock
    }
  };
};

describe('request', () => {
  it('GET request should resolve url, append params and attach token/runtime headers', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValue({
      data: { code: 200, data: { rows: [] } },
      header: {}
    });

    await request({
      url: '/system/user/list',
      method: 'GET',
      params: {
        pageNum: 1,
        pageSize: 10,
        nested: {
          status: '0'
        }
      }
    });

    expect(mocks.requestMock).toHaveBeenCalledTimes(1);
    const payload = mocks.requestMock.mock.calls[0][0];
    expect(payload.url).toContain('https://api.example.com/mini-api/system/user/list?');
    expect(payload.url).toContain('pageNum=1');
    expect(payload.url).toContain('nested%5Bstatus%5D=0');
    expect(payload.method).toBe('GET');
    expect(payload.data).toBeUndefined();
    expect(payload.header).toMatchObject({
      clientid: 'client-id',
      Authorization: 'Bearer token-1',
      'x-client-key': 'miniapp',
      'x-device-type': 'miniapp'
    });
  });

  it('should default request method to GET when method is omitted', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValue({
      data: { code: 200, data: null },
      header: {}
    });

    await request({
      url: '/monitor/cache'
    });

    expect(mocks.requestMock.mock.calls[0][0].method).toBe('GET');
  });

  it('should skip authorization header when isToken=false or token is missing', async () => {
    const { request, mocks } = await setupRequestModule({ token: '' });
    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: '/auth/code',
      method: 'GET',
      headers: {
        isToken: false
      }
    });

    const payload = mocks.requestMock.mock.calls[0][0];
    expect(payload.header.Authorization).toBeUndefined();
  });

  it('should keep absolute request url and preserve custom headers as strings', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: 'https://gateway.example.com/api/ping',
      method: 'GET',
      headers: {
        traceId: 1001
      }
    });

    const payload = mocks.requestMock.mock.calls[0][0];
    expect(payload.url).toBe('https://gateway.example.com/api/ping');
    expect(payload.header.traceId).toBe('1001');
  });

  it('should use h5 relative base api directly', async () => {
    const { request, mocks } = await setupRequestModule({
      mobileEnv: {
        taroEnv: 'h5',
        baseApi: '/h5-api'
      }
    });
    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: '/auth/code',
      method: 'GET'
    });

    const payload = mocks.requestMock.mock.calls[0][0];
    expect(payload.url).toBe('/h5-api/auth/code');
    expect(payload.header['x-client-key']).toBeUndefined();
    expect(payload.header['x-device-type']).toBeUndefined();
  });

  it('should append query params with ampersand when url already contains query string', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: '/system/user/list?fixed=1',
      method: 'GET',
      params: {
        pageNum: 2
      }
    });

    const payload = mocks.requestMock.mock.calls[0][0];
    expect(payload.url).toContain('fixed=1&pageNum=2');
  });

  it('should use api origin directly when mini base api is empty in weapp runtime', async () => {
    const { request, mocks } = await setupRequestModule({
      mobileEnv: {
        taroEnv: 'weapp',
        miniBaseApi: '',
        apiOrigin: 'https://api.example.com/'
      }
    });
    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: '/auth/code',
      method: 'GET'
    });

    const payload = mocks.requestMock.mock.calls[0][0];
    expect(payload.url).toBe('https://api.example.com/auth/code');
  });

  it('should support non-slash mini base api and non-slash request path', async () => {
    const { request, mocks } = await setupRequestModule({
      mobileEnv: {
        taroEnv: 'weapp',
        miniBaseApi: 'mini-api-no-slash',
        apiOrigin: 'https://api.example.com/'
      }
    });
    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: 'monitor/cache',
      method: 'GET'
    });

    const payload = mocks.requestMock.mock.calls[0][0];
    expect(payload.url).toBe('https://api.example.com/mini-api-no-slash/monitor/cache');
  });

  it('should fail fast when weapp api origin is missing', async () => {
    const { request, AppError } = await setupRequestModule({
      mobileEnv: {
        taroEnv: 'weapp',
        apiOrigin: '',
        miniBaseApi: '/mini-api'
      }
    });

    await expect(
      request({
        url: '/monitor/cache',
        method: 'GET'
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('POST request should encrypt payload when isEncrypt=true and encrypt enabled', async () => {
    const { request, mocks } = await setupRequestModule({
      mobileEnv: {
        encrypt: true
      }
    });

    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: '/system/user/profile/updatePwd',
      method: 'POST',
      headers: {
        isEncrypt: true,
        repeatSubmit: false
      },
      data: {
        oldPassword: 'old',
        newPassword: 'new'
      }
    });

    expect(mocks.generateAesKeyMock).toHaveBeenCalledTimes(1);
    expect(mocks.encryptBase64Mock).toHaveBeenCalledWith('generated-aes-key');
    expect(mocks.encryptMock).toHaveBeenCalledWith('b64:generated-aes-key');
    expect(mocks.encryptWithAesMock).toHaveBeenCalled();

    const payload = mocks.requestMock.mock.calls[0][0];
    expect(payload.data).toContain('enc:');
    expect(payload.header['encrypt-key']).toBe('rsa-encrypted-key');
  });

  it('PUT encryption should pass through string payload directly', async () => {
    const { request, mocks } = await setupRequestModule({
      mobileEnv: {
        encrypt: true
      }
    });
    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: '/system/notice',
      method: 'PUT',
      headers: {
        isEncrypt: 'true',
        repeatSubmit: 'false'
      },
      data: 'plain-string'
    });

    expect(mocks.encryptWithAesMock).toHaveBeenCalledWith('plain-string', 'generated-aes-key');
  });

  it('POST encryption should serialize empty payload object when data is undefined', async () => {
    const { request, mocks } = await setupRequestModule({
      mobileEnv: {
        encrypt: true
      }
    });
    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: '/system/notice',
      method: 'POST',
      headers: {
        isEncrypt: true,
        repeatSubmit: false
      }
    });

    expect(mocks.encryptWithAesMock).toHaveBeenCalledWith('{}', 'generated-aes-key');
  });

  it('POST duplicate fingerprint should treat undefined data as empty object', async () => {
    const { request, AppError, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: '/system/dict/type/list',
      method: 'POST'
    });

    await expect(
      request({
        url: '/system/dict/type/list',
        method: 'POST'
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('POST encryption should fail when rsa encrypt returns empty', async () => {
    const { request, AppError } = await setupRequestModule({
      mobileEnv: {
        encrypt: true
      },
      rsaEncryptReturn: ''
    });

    await expect(
      request({
        url: '/system/user/profile/updatePwd',
        method: 'POST',
        headers: {
          isEncrypt: true
        },
        data: {
          oldPassword: 'old',
          newPassword: 'new'
        }
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should block duplicate submit for POST/PUT unless repeatSubmit is disabled', async () => {
    const { request, AppError, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValue({ data: { code: 200, data: null }, header: {} });

    await request({
      url: '/system/notice',
      method: 'POST',
      data: { noticeTitle: 'n1' }
    });

    await expect(
      request({
        url: '/system/notice',
        method: 'POST',
        data: { noticeTitle: 'n1' }
      })
    ).rejects.toBeInstanceOf(AppError);

    await request({
      url: '/system/notice',
      method: 'POST',
      headers: {
        repeatSubmit: false
      },
      data: { noticeTitle: 'n1' }
    });

    expect(mocks.requestMock).toHaveBeenCalledTimes(2);
  });

  it('should decrypt encrypted response payload via encrypt-key header', async () => {
    const { request, mocks } = await setupRequestModule({
      rsaDecryptReturn: 'base64-aes-from-header'
    });

    mocks.decryptBase64Mock.mockReturnValue('aes-key-from-header');
    mocks.decryptWithAesMock.mockReturnValue('{"code":200,"data":{"id":101}}');

    mocks.requestMock.mockResolvedValue({
      data: 'cipher-response',
      header: {
        'Encrypt-Key': 'server-rsa-key'
      }
    });

    const payload = await request<{ code: number; data: { id: number } }>({
      url: '/system/user/getInfo',
      method: 'GET'
    });

    expect(mocks.decryptMock).toHaveBeenCalledWith('server-rsa-key');
    expect(mocks.decryptBase64Mock).toHaveBeenCalledWith('base64-aes-from-header');
    expect(mocks.decryptWithAesMock).toHaveBeenCalledWith('cipher-response', 'aes-key-from-header');
    expect(payload.data.id).toBe(101);
  });

  it('should skip decrypt path when response header is missing', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValue({
      data: {
        code: 200,
        data: {
          ok: true
        }
      }
    });

    const payload = await request<{ code: number; data: { ok: boolean } }>({
      url: '/system/user/getInfo',
      method: 'GET'
    });

    expect(payload.data.ok).toBe(true);
    expect(mocks.decryptMock).not.toHaveBeenCalled();
  });

  it('should ignore non encrypt-key headers in decrypt path', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValue({
      data: {
        code: 200,
        data: {
          ok: true
        }
      },
      header: {
        'x-request-id': 'req-1'
      }
    });

    const payload = await request<{ code: number; data: { ok: boolean } }>({
      url: '/system/user/getInfo',
      method: 'GET'
    });

    expect(payload.data.ok).toBe(true);
    expect(mocks.decryptMock).not.toHaveBeenCalled();
  });

  it('should treat empty encrypt-key value as non-encrypted response', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValue({
      data: {
        code: 200,
        data: {
          ok: true
        }
      },
      header: {
        'encrypt-key': ''
      }
    });

    const payload = await request<{ code: number; data: { ok: boolean } }>({
      url: '/system/user/getInfo',
      method: 'GET'
    });

    expect(payload.data.ok).toBe(true);
    expect(mocks.decryptMock).not.toHaveBeenCalled();
  });

  it('should fail when encrypted response key cannot be decrypted', async () => {
    const { request, AppError, mocks } = await setupRequestModule({
      rsaDecryptReturn: ''
    });

    mocks.requestMock.mockResolvedValue({
      data: 'cipher-response',
      header: {
        'encrypt-key': 'server-rsa-key'
      }
    });

    await expect(
      request({
        url: '/system/user/getInfo',
        method: 'GET'
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should throw AuthError and remove token when response code is 401', async () => {
    const { request, AuthError, mocks } = await setupRequestModule();

    mocks.requestMock.mockResolvedValue({
      data: {
        code: 401,
        msg: 'token expired'
      },
      header: {}
    });

    await expect(
      request({
        url: '/system/user/getInfo',
        method: 'GET'
      })
    ).rejects.toBeInstanceOf(AuthError);

    expect(mocks.removeTokenMock).toHaveBeenCalledTimes(1);
  });

  it('should use default 401 message when backend msg is empty', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValue({
      data: {
        code: 401,
        msg: ''
      },
      header: {}
    });

    await expect(
      request({
        url: '/system/user/getInfo',
        method: 'GET'
      })
    ).rejects.toThrow('认证失败，无法访问系统资源');
  });

  it('should map non-200 api code to AppError messages', async () => {
    const { request, AppError, mocks } = await setupRequestModule();

    mocks.requestMock.mockResolvedValueOnce({
      data: {
        code: 403,
        msg: ''
      },
      header: {}
    });

    await expect(
      request({
        url: '/system/user/getInfo',
        method: 'GET'
      })
    ).rejects.toBeInstanceOf(AppError);

    mocks.requestMock.mockResolvedValueOnce({
      data: {
        code: 499,
        msg: ''
      },
      header: {}
    });

    await expect(
      request({
        url: '/system/user/getInfo',
        method: 'GET'
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should reject non-object success payloads as response contract errors', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValueOnce({
      data: 'raw-text-success',
      header: {}
    });

    await expect(request<string>({
      url: '/monitor/cache',
      method: 'GET'
    })).rejects.toThrow('响应体必须是对象');
  });

  it('should reject response payloads without code or pagination total', async () => {
    const { request, mocks } = await setupRequestModule();

    mocks.requestMock.mockResolvedValueOnce({
      data: {
        data: {
          ok: true
        }
      },
      header: {}
    });

    await expect(request({
      url: '/monitor/cache',
      method: 'GET'
    })).rejects.toThrow('缺少状态码 code');

    mocks.requestMock.mockResolvedValueOnce({
      data: {
        code: 200,
        rows: []
      },
      header: {}
    });

    await expect(request({
      url: '/system/user/list',
      method: 'GET'
    })).rejects.toThrow('分页响应 total 必须是有限数字');
  });

  it('should map non-numeric response code to AppError', async () => {
    const { request, AppError, mocks } = await setupRequestModule();
    mocks.requestMock.mockResolvedValueOnce({
      data: {
        code: 'code-not-number',
        msg: ''
      },
      header: {}
    });

    await expect(
      request({
        url: '/system/user/getInfo',
        method: 'GET'
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should normalize network failures and keep AppError as-is', async () => {
    const { request, AppError, mocks } = await setupRequestModule();

    mocks.requestMock.mockRejectedValueOnce(new Error('timeout exceeded'));
    await expect(
      request({
        url: '/monitor/cache',
        method: 'GET'
      })
    ).rejects.toBeInstanceOf(AppError);

    mocks.requestMock.mockRejectedValueOnce(new Error('request:fail socket hang up'));
    await expect(
      request({
        url: '/monitor/cache',
        method: 'GET'
      })
    ).rejects.toBeInstanceOf(AppError);

    const passthrough = new AppError('already-app-error', 'api');
    mocks.requestMock.mockRejectedValueOnce(passthrough);

    await expect(
      request({
        url: '/monitor/cache',
        method: 'GET'
      })
    ).rejects.toBe(passthrough);
  });

  it('should normalize non-Error rejections by string coercion', async () => {
    const { request, AppError, mocks } = await setupRequestModule();
    mocks.requestMock.mockRejectedValueOnce('plain-string-rejection');

    await expect(
      request({
        url: '/monitor/cache',
        method: 'GET'
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should normalize non-object primitive rejection by String(error)', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockRejectedValueOnce(503);

    await expect(
      request({
        url: '/monitor/cache',
        method: 'GET'
      })
    ).rejects.toThrow('503');
  });

  it('should normalize undefined rejection into default network message', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockRejectedValueOnce(undefined);

    await expect(
      request({
        url: '/monitor/cache',
        method: 'GET'
      })
    ).rejects.toThrow('请求失败，请稍后重试。');
  });

  it('should normalize domain whitelist rejection into explicit mini-program message', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockRejectedValueOnce({
      errMsg: 'request:fail url not in domain list'
    });

    await expect(
      request({
        url: '/monitor/cache',
        method: 'GET'
      })
    ).rejects.toThrow('小程序请求域名未在合法域名列表，请检查开发者工具域名校验配置。');
  });

  it.each([
    {
      caseId: 'V-RQ-01',
      rejection: { data: { message: 'from-error-data-message' } },
      expectedMessage: 'from-error-data-message'
    },
    {
      caseId: 'V-RQ-02',
      rejection: { data: { msg: 'from-error-data-msg' } },
      expectedMessage: 'from-error-data-msg'
    },
    {
      caseId: 'V-RQ-03',
      rejection: { response: { message: 'from-error-response-message' } },
      expectedMessage: 'from-error-response-message'
    },
    {
      caseId: 'V-RQ-04',
      rejection: { response: { msg: 'from-error-response-msg' } },
      expectedMessage: 'from-error-response-msg'
    },
    {
      caseId: 'V-RQ-05',
      rejection: { response: { data: { message: 'from-error-response-data-message' } } },
      expectedMessage: 'from-error-response-data-message'
    },
    {
      caseId: 'V-RQ-06',
      rejection: { response: { data: { msg: 'from-error-response-data-msg' } } },
      expectedMessage: 'from-error-response-data-msg'
    }
  ])('$caseId should extract message from nested rejection payload', async ({ rejection, expectedMessage }) => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockRejectedValueOnce(rejection);

    await expect(
      request({
        url: '/monitor/cache',
        method: 'GET'
      })
    ).rejects.toThrow(expectedMessage);
  });

  it('V-RQ-07 should fallback to default message when nested message fields are empty strings', async () => {
    const { request, AppError, mocks } = await setupRequestModule();
    mocks.requestMock.mockRejectedValueOnce({
      data: { message: '  ', msg: '' },
      response: {
        message: '',
        msg: ' ',
        data: {
          message: '',
          msg: '  '
        }
      }
    });

    let captured: unknown;
    try {
      await request({
        url: '/monitor/cache',
        method: 'GET'
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(AppError);
    expect((captured as Error).message).toBe('请求失败，请稍后重试。');
    expect((captured as Error).message).not.toContain('[object Object]');
  });

  it('should normalize opaque object rejection into default message instead of object string', async () => {
    const { request, mocks } = await setupRequestModule();
    mocks.requestMock.mockRejectedValueOnce({
      reason: 'unexpected object payload'
    });

    await expect(
      request({
        url: '/monitor/cache',
        method: 'GET'
      })
    ).rejects.toThrow('请求失败，请稍后重试。');
  });

  it('uploadFile should resolve url/header and parse encrypted payload from headers fallback', async () => {
    const { uploadFile, mocks } = await setupRequestModule();

    mocks.decryptBase64Mock.mockReturnValue('upload-aes');
    mocks.decryptWithAesMock.mockReturnValue('{"code":200,"data":{"imgUrl":"/a.png"}}');

    mocks.uploadFileMock.mockResolvedValue({
      data: '{"code":200,"data":{"imgUrl":"placeholder"}}',
      headers: {
        'encrypt-key': 'upload-rsa-header'
      }
    });

    const payload = await uploadFile<{ code: number; data: { imgUrl: string } }>({
      url: '/system/user/profile/avatar',
      filePath: '/tmp/avatar.png'
    });

    const options = mocks.uploadFileMock.mock.calls[0][0];
    expect(options.url).toBe('https://api.example.com/mini-api/system/user/profile/avatar');
    expect(options.name).toBe('file');
    expect(options.timeout).toBe(50000);
    expect(options.header.Authorization).toBe('Bearer token-1');
    expect(payload.data.imgUrl).toBe('/a.png');
  });

  it('uploadFile should honor custom options and normalize network failures', async () => {
    const { uploadFile, AppError, mocks } = await setupRequestModule();

    mocks.uploadFileMock.mockRejectedValueOnce(new Error('timeout while uploading'));

    await expect(
      uploadFile({
        url: '/system/user/profile/avatar',
        filePath: '/tmp/avatar.png',
        name: 'avatarfile',
        timeout: 15000,
        formData: {
          scene: 'profile'
        },
        headers: {
          isToken: false
        }
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('uploadFile should reject empty or invalid json response payloads', async () => {
    const { uploadFile, mocks } = await setupRequestModule();
    mocks.uploadFileMock.mockResolvedValue({
      data: '',
      header: {}
    });

    await expect(uploadFile<Record<string, unknown>>({
      url: '/system/user/profile/avatar',
      filePath: '/tmp/avatar.png'
    })).rejects.toThrow('上传响应契约错误：响应体不能为空');

    mocks.uploadFileMock.mockResolvedValueOnce({
      data: 'not-json',
      header: {}
    });

    await expect(uploadFile<Record<string, unknown>>({
      url: '/system/user/profile/avatar',
      filePath: '/tmp/avatar.png'
    })).rejects.toThrow('上传响应契约错误：响应体必须是合法 JSON');
  });
});
