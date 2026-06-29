// @ts-ignore
/* eslint-disable */
import {request} from '@umijs/max';

const clientId = process.env.VITE_APP_CLIENT_ID;

/** 获取当前用户详情 GET /system/user/getInfo */
export async function getInfo(options?: { [key: string]: any }) {
  return request<API.ApiResponse<API.UserInfo>>('/system/user/getInfo', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 兼容 Pro 模板命名，真实数据来自后端 getInfo。 */
export async function currentUser(options?: { [key: string]: any }) {
  return getInfo(options);
}

/** 获取后端动态菜单 GET /system/menu/getRouters */
export async function getRouters(options?: { [key: string]: any }) {
  return request<API.ApiResponse<API.AppRoute[]>>('/system/menu/getRouters', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取图形验证码 GET /auth/code */
export async function getCodeImg(options?: { [key: string]: any }) {
  return request<API.ApiResponse<API.VerifyCodeResult>>('/auth/code', {
    method: 'GET',
    headers: {
      isToken: false,
    },
    timeout: 20000,
    ...(options || {}),
  });
}

/** 退出登录接口 POST /auth/logout */
export async function outLogin(options?: { [key: string]: any }) {
  if (process.env.VITE_APP_SSE === 'true') {
    await request('/resource/sse/close', { method: 'GET' }).catch(() => undefined);
  }
  return request<Record<string, any>>('/auth/logout', {
    method: 'POST',
    ...(options || {}),
  });
}

/** 登录接口 POST /auth/login */
export async function login(body: API.LoginParams, options?: { [key: string]: any }) {
  return request<API.ApiResponse<API.LoginResult>>('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      isToken: false,
      isEncrypt: 'true',
      repeatSubmit: false,
    },
    data: {
      username: body.username,
      password: body.password,
      rememberMe: body.rememberMe,
      code: body.code,
      uuid: body.uuid,
      clientId: body.clientId || clientId,
      grantType: body.grantType || 'password',
    },
    ...(options || {}),
  });
}

export async function getOAuthProviders(options?: { [key: string]: any }) {
  return request<API.ApiResponse<API.OAuthProviderOption[]>>('/auth/oauth/providers', {
    method: 'GET',
    headers: {
      isToken: false,
    },
    ...(options || {}),
  });
}

export async function exchangeOAuthTicket(
  body: API.OAuthTicketData,
  options?: { [key: string]: any },
) {
  return request<API.ApiResponse<API.LoginResult>>('/auth/oauth/ticket', {
    method: 'POST',
    headers: {
      isToken: false,
      isEncrypt: 'true',
      repeatSubmit: false,
    },
    data: {
      ...body,
      clientId: body.clientId || clientId,
      grantType: body.grantType || 'oauth',
    },
    ...(options || {}),
  });
}

export async function register(body: API.RegisterForm, options?: { [key: string]: any }) {
  return request<API.ApiResult>('/auth/register', {
    method: 'POST',
    headers: {
      isToken: false,
      isEncrypt: 'true',
      repeatSubmit: false,
    },
    data: {
      ...body,
      clientId,
      grantType: 'password',
    },
    ...(options || {}),
  });
}

export async function forgotPassword(
  body: API.ForgotPasswordForm,
  options?: { [key: string]: any },
) {
  return request<API.ApiResult>('/auth/forgot-password', {
    method: 'POST',
    headers: {
      isToken: false,
      isEncrypt: 'true',
      repeatSubmit: false,
    },
    data: body,
    ...(options || {}),
  });
}

export async function sendEmailCode(body: API.SendEmailCodeForm, options?: { [key: string]: any }) {
  return request<API.ApiResult>('/auth/email/code', {
    method: 'POST',
    headers: {
      isToken: false,
      isEncrypt: 'true',
      repeatSubmit: false,
    },
    data: body,
    ...(options || {}),
  });
}
