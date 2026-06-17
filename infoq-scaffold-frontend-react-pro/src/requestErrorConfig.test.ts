import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorConfig } from './requestErrorConfig';

const mockModal = vi.hoisted(() => ({
  msgWarning: vi.fn(),
  msgError: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('@/utils/modal', () => ({
  default: mockModal,
}));

vi.mock('@umijs/max', () => ({
  getIntl: vi.fn(() => ({
    formatMessage: vi.fn(({ defaultMessage }) => defaultMessage),
  })),
}));

describe('requestErrorConfig', () => {
  // biome-ignore lint/style/noNonNullAssertion: config handlers are always defined
  const errorThrower = errorConfig.errorConfig!.errorThrower!;
  // biome-ignore lint/style/noNonNullAssertion: config handlers are always defined
  const errorHandler = errorConfig.errorConfig!.errorHandler!;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    process.env.VITE_APP_CLIENT_ID = 'test-client-id';
  });

  describe('errorThrower', () => {
    it('should throw error when success is false', () => {
      const response = {
        success: false,
        data: null,
        errorCode: 400,
        errorMessage: 'Bad Request',
        showType: 2,
      };

      expect(() => {
        errorThrower(response);
      }).toThrow('Bad Request');
    });

    it('should not throw error when success is true', () => {
      const response = {
        success: true,
        data: { id: 1 },
      };

      expect(() => {
        errorThrower(response);
      }).not.toThrow();
    });

    it('should not throw error when legacy code is success', () => {
      const response = {
        code: 200,
        msg: '操作成功',
        data: { id: 1 },
      };

      expect(() => {
        errorThrower(response);
      }).not.toThrow();
    });

    it('should throw BizError when legacy code is not success', () => {
      const response = {
        code: 500,
        msg: '系统错误',
        data: null,
      };

      expect.assertions(4);
      try {
        errorThrower(response);
      } catch (error: any) {
        expect(error.name).toBe('BizError');
        expect(error.message).toBe('系统错误');
        expect(error.info.errorCode).toBe(500);
        expect(error.info.showType).toBe(2);
      }
    });

    it('should throw BizError with correct info', () => {
      const response = {
        success: false,
        data: { detail: 'more info' },
        errorCode: 403,
        errorMessage: 'Forbidden',
        showType: 3,
      };

      expect.assertions(5);
      try {
        errorThrower(response);
      } catch (error: any) {
        expect(error.name).toBe('BizError');
        expect(error.info.errorCode).toBe(403);
        expect(error.info.errorMessage).toBe('Forbidden');
        expect(error.info.showType).toBe(3);
        expect(error.info.data).toEqual({ detail: 'more info' });
      }
    });
  });

  describe('errorHandler', () => {
    it('should rethrow error when skipErrorHandler is true', () => {
      const error = new Error('Test error');
      const opts = { skipErrorHandler: true };

      expect(() => {
        errorHandler(error, opts);
      }).toThrow('Test error');
    });

    it('should handle SILENT showType', () => {
      const error: any = new Error('Silent error');
      error.name = 'BizError';
      error.info = {
        errorCode: 1001,
        errorMessage: 'Silent error',
        showType: 0,
      };

      errorHandler(error, {});

      expect(mockModal.msgWarning).not.toHaveBeenCalled();
      expect(mockModal.msgError).not.toHaveBeenCalled();
      expect(mockModal.notifyError).not.toHaveBeenCalled();
    });

    it('should handle WARN_MESSAGE showType', () => {
      const error: any = new Error('Warning');
      error.name = 'BizError';
      error.info = {
        errorCode: 1002,
        errorMessage: 'This is a warning',
        showType: 1,
      };

      errorHandler(error, {});

      expect(mockModal.msgWarning).toHaveBeenCalledWith('This is a warning');
    });

    it('should handle ERROR_MESSAGE showType', () => {
      const error: any = new Error('Error message');
      error.name = 'BizError';
      error.info = {
        errorCode: 1003,
        errorMessage: 'This is an error',
        showType: 2,
      };

      errorHandler(error, {});

      expect(mockModal.msgError).toHaveBeenCalledWith('This is an error');
    });

    it('should handle NOTIFICATION showType', () => {
      const error: any = new Error('Notification');
      error.name = 'BizError';
      error.info = {
        errorCode: 1004,
        errorMessage: 'This is a notification',
        showType: 3,
      };

      errorHandler(error, {});

      expect(mockModal.notifyError).toHaveBeenCalledWith({
        title: '1004',
        description: 'This is a notification',
      });
    });

    it('should handle REDIRECT showType', () => {
      const error: any = new Error('Redirect');
      error.name = 'BizError';
      error.info = {
        errorCode: 401,
        errorMessage: 'Unauthorized',
        showType: 9,
      };

      errorHandler(error, {});

      // REDIRECT 分支不应触发任何消息/通知提示
      expect(mockModal.msgWarning).not.toHaveBeenCalled();
      expect(mockModal.msgError).not.toHaveBeenCalled();
      expect(mockModal.notifyError).not.toHaveBeenCalled();
    });

    it('should handle default case for unknown showType', () => {
      const error: any = new Error('Unknown type');
      error.name = 'BizError';
      error.info = {
        errorCode: 1005,
        errorMessage: 'Unknown error type',
        showType: 99,
      };

      errorHandler(error, {});

      expect(mockModal.msgError).toHaveBeenCalledWith('Unknown error type');
    });

    it('should handle axios response error', () => {
      const error: any = new Error('Axios error');
      error.response = {
        status: 500,
        data: {},
      };

      errorHandler(error, {});

      expect(mockModal.msgError).toHaveBeenCalledWith('Response status:500');
    });

    it('should handle offline error', () => {
      const error: any = new Error('Network error');
      error.request = {};

      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      try {
        errorHandler(error, {});

        expect(mockModal.msgError).toHaveBeenCalledWith(
          'Network unavailable. Please check your connection and try again.',
        );
      } finally {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: originalOnLine,
        });
      }
    });

    it('should handle request error with no response', () => {
      const error: any = new Error('Request error');
      error.request = {};

      errorHandler(error, {});

      expect(mockModal.msgError).toHaveBeenCalledWith(
        'None response! Please retry.',
      );
    });

    it('should handle generic error', () => {
      const error: any = new Error('Generic error');

      errorHandler(error, {});

      expect(mockModal.msgError).toHaveBeenCalledWith(
        'Request error, please retry.',
      );
    });
  });

  describe('requestInterceptors', () => {
    // The interceptor is registered as a plain function (not a tuple),
    // so narrow the union type to a callable for the test.
    const interceptor = errorConfig.requestInterceptors?.[0] as (config: {
      url?: string;
      method?: string;
      headers?: Record<string, unknown>;
    }) => { url?: string; headers?: Record<string, unknown> };

    it('should attach scaffold auth headers', () => {
      localStorage.setItem('Admin-Token', 'token-123');
      localStorage.setItem('language', 'en_US');
      const config = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      const result = interceptor(config);

      expect(result.url).toBe('https://api.example.com/users');
      expect(result.headers).toMatchObject({
        Authorization: 'Bearer token-123',
        clientid: 'test-client-id',
        'Content-Language': 'en_US',
      });
    });

    it('should handle URL without config and use default language', () => {
      const config = {};

      const result = interceptor(config);

      expect(result.url).toBeUndefined();
      expect(result.headers).toMatchObject({
        clientid: 'test-client-id',
        'Content-Language': 'zh_CN',
      });
    });

    it('should not attach token when isToken is false', () => {
      localStorage.setItem('Admin-Token', 'token-123');
      const config = {
        headers: {
          isToken: false,
        },
      };

      const result = interceptor(config);

      expect(result.headers?.Authorization).toBeUndefined();
      expect(result.headers).toMatchObject({
        clientid: 'test-client-id',
      });
      expect(result.headers?.isToken).toBeUndefined();
    });
  });
});
