import request from '@/utils/request';
import type {
  ApiResponse,
  ApiResult,
  ForgotPasswordForm,
  LoginData,
  LoginResult,
  OAuthProviderOption,
  OAuthTicketData,
  RegisterForm,
  SendEmailCodeForm,
  VerifyCodeResult
} from './types';
import { UserInfo } from '@/api/system/user/types';

// pc端固定客户端授权id
const clientId = import.meta.env.VITE_APP_CLIENT_ID;

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

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;
let browserSessionTail: Promise<void> = Promise.resolve();

const runBrowserSession = <T>(operation: () => Promise<T>): Promise<T> => {
  const pending = browserSessionTail.then(operation);
  // 只排序 cookie 副作用；各调用方仍收到本次调用的原始失败，不重试或伪装成功。
  browserSessionTail = pending.then(
    () => undefined,
    () => undefined
  );
  return pending;
};

// 独立于普通 Bearer 拦截器：恢复资源不缓存请求，也不触发 401 注销循环。
const browserSessionRequest = async <T>(method: string, csrf?: string, bearer?: string, suffix = ''): Promise<T> => {
  const apiPrefix = import.meta.env.VITE_APP_BASE_API;
  if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(apiPrefix)) {
    throw new BrowserSessionError(400, '浏览器会话必须通过规范的同源 API 前缀访问');
  }
  const headers: Record<string, string> = {
    clientid: clientId,
    'X-InfoQ-Browser-Session': 'vue'
  };
  if (csrf) headers['X-XSRF-TOKEN'] = csrf;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetch(`${apiPrefix}/auth/browser-session${suffix}`, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal
    });
    // 恢复 401 会清服务端 CSRF cookie；必须在 FIFO 放行下一次绑定前丢弃内存旧值。
    if (method === 'POST' && response.status === 401) clearBrowserSessionCsrf();
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new BrowserSessionError(502, '浏览器会话响应不是有效 JSON', method);
    }
    if (payload?.code !== response.status) throw new BrowserSessionError(502, '浏览器会话 HTTP 与响应状态不一致', method);
    if (!response.ok || response.status !== 200)
      throw new BrowserSessionError(response.status, `浏览器会话请求失败（HTTP ${response.status}）`, method);
    return payload.data as T;
  } finally {
    window.clearTimeout(timeout);
  }
};

export const clearBrowserSessionCsrf = () => {
  csrfToken = null;
  csrfRequest = null;
};

export const getBrowserSessionCsrf = (): Promise<string> => {
  if (csrfToken) return Promise.resolve(csrfToken);
  if (csrfRequest) return csrfRequest;
  const pending = browserSessionRequest<{ token: string; headerName: string }>('GET', undefined, undefined, '/csrf')
    .then((data) => {
      if (typeof data?.token !== 'string' || !data.token || data.headerName !== 'X-XSRF-TOKEN') {
        throw new BrowserSessionError(502, '浏览器会话 CSRF 响应契约错误');
      }
      if (csrfRequest === pending) csrfToken = data.token;
      return data.token;
    })
    .finally(() => {
      if (csrfRequest === pending) csrfRequest = null;
    });
  csrfRequest = pending;
  return pending;
};

export const bindBrowserSession = (token: string): Promise<void> =>
  runBrowserSession(async () => {
    const csrf = await getBrowserSessionCsrf();
    await browserSessionRequest('PUT', csrf, token);
  });

export const restoreBrowserSession = (): Promise<LoginResult> =>
  runBrowserSession(async () => {
    const csrf = await getBrowserSessionCsrf();
    const data = await browserSessionRequest<LoginResult & { client_id: string; expire_in: number }>('POST', csrf);
    if (
      !data ||
      typeof data.access_token !== 'string' ||
      !data.access_token ||
      data.client_id !== clientId ||
      !Number.isFinite(data.expire_in) ||
      !(data.expire_in > 0)
    ) {
      throw new BrowserSessionError(502, '浏览器会话恢复响应契约错误');
    }
    return data;
  });

export const deleteBrowserSession = (): Promise<void> =>
  runBrowserSession(async () => {
    try {
      const csrf = await getBrowserSessionCsrf();
      await browserSessionRequest('DELETE', csrf);
    } finally {
      clearBrowserSessionCsrf();
    }
  });

/**
 * @param data {LoginData}
 * @returns
 */
export function login(data: LoginData): Promise<ApiResponse<LoginResult>> {
  const params = {
    ...data,
    clientId: data.clientId || clientId,
    grantType: data.grantType || 'password'
  };
  return request({
    url: '/auth/login',
    headers: {
      isToken: false,
      isEncrypt: true,
      repeatSubmit: false
    },
    method: 'post',
    data: params
  });
}

export function getOAuthProviders(): Promise<ApiResponse<OAuthProviderOption[]>> {
  return request({
    url: '/auth/oauth/providers',
    headers: {
      isToken: false
    },
    method: 'get'
  });
}

export function exchangeOAuthTicket(data: OAuthTicketData): Promise<ApiResponse<LoginResult>> {
  const params = {
    ...data,
    clientId: data.clientId || clientId,
    grantType: data.grantType || 'oauth'
  };
  return request({
    url: '/auth/oauth/ticket',
    headers: {
      isToken: false,
      isEncrypt: true,
      repeatSubmit: false
    },
    method: 'post',
    data: params
  });
}

// 注册方法
export function register(data: RegisterForm): Promise<ApiResult> {
  const params = {
    ...data,
    clientId: clientId,
    grantType: 'password'
  };
  return request({
    url: '/auth/register',
    headers: {
      isToken: false,
      isEncrypt: true,
      repeatSubmit: false
    },
    method: 'post',
    data: params
  });
}

export function sendEmailCode(data: SendEmailCodeForm): Promise<ApiResult> {
  return request({
    url: '/auth/email/code',
    headers: {
      isToken: false,
      isEncrypt: true,
      repeatSubmit: false
    },
    method: 'post',
    data
  });
}

export function checkInviteCode(inviteCode: string): Promise<ApiResult> {
  return request({
    url: '/auth/invite/code/check',
    headers: {
      isToken: false
    },
    method: 'get',
    params: {
      inviteCode
    }
  });
}

export function forgotPassword(data: ForgotPasswordForm): Promise<ApiResult> {
  return request({
    url: '/auth/forgot-password',
    headers: {
      isToken: false,
      isEncrypt: true,
      repeatSubmit: false
    },
    method: 'post',
    data
  });
}

/**
 * 注销
 */
export async function logout(token: string): Promise<void> {
  const apiPrefix = import.meta.env.VITE_APP_BASE_API;
  if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(apiPrefix)) throw new Error('会话撤销必须通过规范的同源 API 前缀访问');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetch(`${apiPrefix}/auth/logout`, {
      method: 'POST',
      headers: { clientid: clientId, Authorization: `Bearer ${token}` },
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok || (await response.json())?.code !== 200) throw new Error('新登录会话撤销失败');
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * 获取验证码
 */
export function getCodeImg(): Promise<ApiResponse<VerifyCodeResult>> {
  return request({
    url: '/auth/code',
    headers: {
      isToken: false
    },
    method: 'get',
    timeout: 20000
  });
}

// 获取用户详细信息
export function getInfo(): Promise<ApiResponse<UserInfo>> {
  return request({
    url: '/system/user/getInfo',
    method: 'get'
  });
}
