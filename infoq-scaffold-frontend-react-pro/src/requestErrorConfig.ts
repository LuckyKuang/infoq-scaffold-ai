import type { RequestOptions } from '@@/plugin-request/request';
import type { AxiosResponse, RequestConfig } from '@umijs/max';
import { getIntl } from '@umijs/max';
import FileSaver from 'file-saver';
import { clearAuthState, getToken } from './utils/auth';
import {
  decryptBase64,
  decryptWithAes,
  encryptBase64,
  encryptWithAes,
  generateAesKey,
} from './utils/crypto';
import { errorCode } from './utils/errorCode';
import { decrypt, encrypt } from './utils/jsencrypt';
import modal from './utils/modal';
import { blobValidate, tansParams } from './utils/scaffold';

// 错误处理方案： 错误类型
enum ErrorShowType {
  SILENT = 0,
  WARN_MESSAGE = 1,
  ERROR_MESSAGE = 2,
  NOTIFICATION = 3,
  REDIRECT = 9,
}
// 与后端约定的响应数据格式
interface ResponseStructure {
  success: boolean;
  data: unknown;
  errorCode?: number;
  errorMessage?: string;
  showType?: ErrorShowType;
}

interface LegacyResponseStructure {
  code?: number;
  msg?: string;
  data?: unknown;
  rows?: unknown[];
  total?: number;
}

const LEGACY_SUCCESS_CODE = 200;
const encryptHeader = 'encrypt-key';
const repeatSubmitKey = 'sessionObj';
const repeatSubmitInterval = 500;

const hasOwn = (target: unknown, key: string) =>
  typeof target === 'object' && target !== null && Object.hasOwn(target, key);

const getLanguage = () => {
  if (typeof localStorage === 'undefined') {
    return 'zh_CN';
  }
  return localStorage.getItem('language') || 'zh_CN';
};

const isEncryptEnabled = () => process.env.VITE_APP_ENCRYPT === 'true';

const getLoginPath = () => {
  const base = process.env.VITE_APP_CONTEXT_PATH || '/';
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalizedBase}/login`.replace(/\/+/g, '/') || '/login';
};

const redirectToLogin = () => {
  if (typeof window === 'undefined') {
    return;
  }
  clearAuthState();
  const loginPath = getLoginPath();
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (window.location.pathname === loginPath) {
    return;
  }
  window.location.href = `${loginPath}?redirect=${encodeURIComponent(currentPath)}`;
};

const shouldSkipToken = (headers: Record<string, unknown>) =>
  headers.isToken === false || headers.isToken === 'false';

const shouldSkipRepeatSubmit = (headers: Record<string, unknown>) =>
  headers.repeatSubmit === false || headers.repeatSubmit === 'false';

const shouldEncrypt = (headers: Record<string, unknown>) =>
  headers.isEncrypt === true || headers.isEncrypt === 'true';

const isMutableMethod = (method?: string) =>
  ['post', 'put'].includes((method || 'get').toLowerCase());

const encodeGetParams = (config: RequestOptions) => {
  if ((config.method || 'get').toLowerCase() !== 'get' || !config.params) {
    return config;
  }
  const query = tansParams(config.params as Record<string, unknown>);
  if (!query) {
    return config;
  }
  const separator = String(config.url || '').includes('?') ? '&' : '?';
  return {
    ...config,
    params: {},
    url: `${config.url}${separator}${query.slice(0, -1)}`,
  };
};

const guardRepeatSubmit = (
  config: RequestOptions,
  headers: Record<string, unknown>,
) => {
  if (
    typeof sessionStorage === 'undefined' ||
    shouldSkipRepeatSubmit(headers) ||
    !isMutableMethod(config.method)
  ) {
    return;
  }

  const requestObj = {
    url: config.url,
    data:
      typeof config.data === 'object'
        ? JSON.stringify(config.data)
        : config.data,
    time: Date.now(),
  };
  const sessionValue = sessionStorage.getItem(repeatSubmitKey);
  if (sessionValue) {
    const sessionObj = JSON.parse(sessionValue) as typeof requestObj;
    if (
      sessionObj.data === requestObj.data &&
      requestObj.time - sessionObj.time < repeatSubmitInterval &&
      sessionObj.url === requestObj.url
    ) {
      throw new Error('数据正在处理，请勿重复提交');
    }
  }
  sessionStorage.setItem(repeatSubmitKey, JSON.stringify(requestObj));
};

const encryptRequestBody = (
  config: RequestOptions,
  headers: Record<string, unknown>,
) => {
  if (
    !isEncryptEnabled() ||
    !shouldEncrypt(headers) ||
    !isMutableMethod(config.method)
  ) {
    return config;
  }
  const aesKey = generateAesKey();
  headers[encryptHeader] = encrypt(encryptBase64(aesKey));
  return {
    ...config,
    data:
      typeof config.data === 'object'
        ? encryptWithAes(JSON.stringify(config.data), aesKey)
        : encryptWithAes(String(config.data ?? ''), aesKey),
  };
};

const decryptResponseBody = <T>(response: AxiosResponse<T>) => {
  if (!isEncryptEnabled()) {
    return response;
  }
  const keyStr = response.headers?.[encryptHeader];
  if (!keyStr || typeof response.data !== 'string') {
    return response;
  }
  const base64Str = decrypt(String(keyStr));
  const aesKey = decryptBase64(base64Str);
  const decryptData = decryptWithAes(response.data, aesKey);
  return {
    ...response,
    data: JSON.parse(decryptData),
  };
};

const isBinaryResponse = (response: AxiosResponse) =>
  response.config.responseType === 'blob' ||
  response.config.responseType === 'arraybuffer';

/**
 * @name 错误处理
 * pro 自带的错误处理， 可以在这里做自己的改动
 * @doc https://umijs.org/docs/max/request#配置
 */
export const errorConfig: RequestConfig = {
  // 错误处理： umi@3 的错误处理方案。
  errorConfig: {
    // 错误抛出
    errorThrower: (res) => {
      if (hasOwn(res, 'code')) {
        const { code, msg, data } = res as LegacyResponseStructure;
        if (code !== LEGACY_SUCCESS_CODE) {
          const error: any = new Error(msg || '请求失败');
          error.name = 'BizError';
          error.info = {
            errorCode: code,
            errorMessage: msg || '请求失败',
            showType:
              code === 401
                ? ErrorShowType.REDIRECT
                : ErrorShowType.ERROR_MESSAGE,
            data,
          };
          throw error;
        }
        return;
      }

      if (!hasOwn(res, 'success')) {
        return;
      }

      const { success, data, errorCode, errorMessage, showType } =
        res as unknown as ResponseStructure;
      if (!success) {
        const error: any = new Error(errorMessage);
        error.name = 'BizError';
        error.info = { errorCode, errorMessage, showType, data };
        throw error; // 抛出自制的错误
      }
    },
    // 错误接收及处理
    errorHandler: (error: any, opts: any) => {
      if (opts?.skipErrorHandler) throw error;
      // 我们的 errorThrower 抛出的错误。
      if (error.name === 'BizError') {
        const errorInfo: ResponseStructure | undefined = error.info;
        if (errorInfo) {
          const { errorMessage, errorCode } = errorInfo;
          switch (errorInfo.showType) {
            case ErrorShowType.SILENT:
              // do nothing
              break;
            case ErrorShowType.WARN_MESSAGE:
              modal.msgWarning(errorMessage);
              break;
            case ErrorShowType.ERROR_MESSAGE:
              modal.msgError(errorMessage);
              break;
            case ErrorShowType.NOTIFICATION:
              modal.notifyError({
                title: String(errorCode || '系统提示'),
                description: errorMessage,
              });
              break;
            case ErrorShowType.REDIRECT:
              redirectToLogin();
              break;
            default:
              modal.msgError(errorMessage);
          }
        }
      } else if (error.response) {
        // Axios 的错误
        // 请求成功发出且服务器也响应了状态码，但状态代码超出了 2xx 的范围
        modal.msgError(`Response status:${error.response.status}`);
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        modal.msgError(
          getIntl().formatMessage({
            id: 'app.request.offline',
            defaultMessage:
              'Network unavailable. Please check your connection and try again.',
          }),
        );
      } else if (error.request) {
        modal.msgError('None response! Please retry.');
      } else {
        modal.msgError('Request error, please retry.');
      }
    },
  },

  // 请求拦截器
  requestInterceptors: [
    (config: RequestOptions) => {
      type HeaderValue = string | number | boolean;
      const headers = { ...(config.headers || {}) } as NonNullable<
        RequestOptions['headers']
      > &
        Record<string, HeaderValue>;
      const token = getToken();

      headers['Content-Language'] =
        headers['Content-Language'] || getLanguage();

      if (!headers.clientid && process.env.VITE_APP_CLIENT_ID) {
        headers.clientid = process.env.VITE_APP_CLIENT_ID;
      }

      if (token && !shouldSkipToken(headers)) {
        headers.Authorization = `Bearer ${token}`;
      }

      guardRepeatSubmit(config, headers);
      let nextConfig = encodeGetParams({ ...config, headers });
      nextConfig = encryptRequestBody(nextConfig, headers);

      delete headers.isToken;
      delete headers.repeatSubmit;
      delete headers.isEncrypt;

      if (nextConfig.data instanceof FormData) {
        delete headers['Content-Type'];
      }

      return {
        ...nextConfig,
        headers,
      };
    },
  ],

  // 响应拦截器
  responseInterceptors: [
    (response) => {
      const nextResponse = decryptResponseBody(response);
      if (isBinaryResponse(nextResponse)) {
        return nextResponse;
      }
      errorConfig.errorConfig?.errorThrower?.(nextResponse.data);
      return nextResponse;
    },
  ],
};

export function download(
  url: string,
  params: Record<string, unknown>,
  fileName: string,
) {
  return import('@umijs/max').then(({ request }) =>
    request<Blob>(url, {
      method: 'POST',
      transformRequest: [
        (body: Record<string, unknown>) => {
          return tansParams(body);
        },
      ],
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      responseType: 'blob',
      data: params,
    })
      .then(async (blob) => {
        if (blobValidate(blob)) {
          FileSaver.saveAs(new Blob([blob]), fileName);
          return;
        }
        const resText = await new Blob([blob]).text();
        const rspObj = JSON.parse(resText) as {
          code?: string | number;
          msg?: string;
        };
        const errMsg =
          errorCode[String(rspObj.code)] || rspObj.msg || errorCode.default;
        modal.msgError(errMsg);
      })
      .catch(() => {
        modal.msgError('下载文件出现错误，请联系管理员！');
      }),
  );
}
