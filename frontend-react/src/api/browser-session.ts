import axios from 'axios';
import type { LoginResult } from '@/api/types';

export class BrowserSessionError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly method?: string
  ) {
    super(message);
    this.name = 'BrowserSessionError';
  }
}

// 此实例不经过业务请求的 Bearer、重复提交缓存或 401 重登拦截器。
const browserSessionRequest = axios.create({ baseURL: import.meta.env.VITE_APP_BASE_API, timeout: 15000, withXSRFToken: false });
let csrfToken = '';
let csrfRequest: Promise<string> | undefined;
let sessionOperation: Promise<void> = Promise.resolve();

// 响应会修改同名 cookie；版本检查只能挡内存回填，不能阻止旧 Set-Cookie 覆盖新绑定。
function serializeSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
  const pending = sessionOperation.then(operation);
  // 队列只等待完成；调用方仍获得原始 pending，并接收实际失败。
  sessionOperation = pending.then(
    () => undefined,
    () => undefined
  );
  return pending;
}

async function callSession(method: 'get' | 'post' | 'put' | 'delete', suffix = '', token = '') {
  const baseApi = browserSessionRequest.defaults.baseURL;
  if (typeof baseApi !== 'string' || !/^\/[a-zA-Z0-9_-]+$/.test(baseApi)) {
    throw new BrowserSessionError(0, '浏览器会话要求同源 API 代理前缀', method);
  }
  const headers: Record<string, string> = {
    clientid: import.meta.env.VITE_APP_CLIENT_ID,
    'X-InfoQ-Browser-Session': 'react'
  };
  if (method !== 'get') headers['X-XSRF-TOKEN'] = await getBrowserSessionCsrf();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await browserSessionRequest({ method, url: `/auth/browser-session${suffix}`, headers, validateStatus: () => true });
    const body = response.data;
    if (typeof body?.code !== 'number' || body.code !== response.status) {
      throw new BrowserSessionError(0, '浏览器会话响应 HTTP 与业务状态不一致', method);
    }
    if (response.status !== 200) {
      throw new BrowserSessionError(response.status, `浏览器会话${method === 'get' ? '引导' : '操作'}失败（${response.status}）`, method);
    }
    return body.data;
  } catch (error) {
    if (error instanceof BrowserSessionError) throw error;
    throw new BrowserSessionError(0, '浏览器会话请求失败，请检查网络后重试', method);
  }
}

export function clearBrowserSessionCsrf() {
  csrfToken = '';
  csrfRequest = undefined;
}

function getBrowserSessionCsrf(): Promise<string> {
  if (csrfToken) return Promise.resolve(csrfToken);
  if (csrfRequest) return csrfRequest;
  const pending = callSession('get', '/csrf')
    .then((data) => {
      if (typeof data?.token !== 'string' || !data.token || data.headerName !== 'X-XSRF-TOKEN') {
        throw new BrowserSessionError(0, '浏览器会话 CSRF 响应无效');
      }
      if (csrfRequest === pending) csrfToken = data.token;
      return data.token as string;
    })
    .finally(() => {
      if (csrfRequest === pending) csrfRequest = undefined;
    });
  csrfRequest = pending;
  return pending;
}

export function bindBrowserSession(token: string) {
  return serializeSessionOperation(async () => {
    try {
      await callSession('put', '', token);
    } catch (error) {
      clearBrowserSessionCsrf();
      throw error;
    }
  });
}

export function restoreBrowserSession(): Promise<LoginResult> {
  return serializeSessionOperation(async () => {
    const data = await callSession('post').catch((error: unknown) => {
      if (error instanceof BrowserSessionError && error.status === 401 && error.method === 'post') {
        clearBrowserSessionCsrf();
      }
      throw error;
    });
    if (
      typeof data?.access_token !== 'string' ||
      !data.access_token ||
      data.client_id !== import.meta.env.VITE_APP_CLIENT_ID ||
      !Number.isFinite(data.expire_in) ||
      data.expire_in <= 0
    ) {
      throw new BrowserSessionError(0, '浏览器会话恢复响应无效');
    }
    return data;
  });
}

export function deleteBrowserSession() {
  return serializeSessionOperation(async () => {
    try {
      await callSession('delete');
    } finally {
      clearBrowserSessionCsrf();
    }
  });
}

export { browserSessionRequest };
