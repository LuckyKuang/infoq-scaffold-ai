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
import type { UserInfo } from '@/api/system/user/types';

// pc端固定客户端授权id
const clientId = import.meta.env.VITE_APP_CLIENT_ID;

/**
 * @param data {LoginData}
 * @returns
 */
export function login(data: LoginData) {
  const params = {
    ...data,
    clientId: data.clientId || clientId,
    grantType: data.grantType || 'password'
  };
  return request<ApiResponse<LoginResult>>({
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

export function getOAuthProviders() {
  return request<ApiResponse<OAuthProviderOption[]>>({
    url: '/auth/oauth/providers',
    headers: {
      isToken: false
    },
    method: 'get'
  });
}

export function exchangeOAuthTicket(data: OAuthTicketData) {
  const params = {
    ...data,
    clientId: data.clientId || clientId,
    grantType: data.grantType || 'oauth'
  };
  return request<ApiResponse<LoginResult>>({
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
export function register(data: RegisterForm) {
  const params = {
    ...data,
    clientId: clientId,
    grantType: 'password'
  };
  return request<ApiResult>({
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

export function sendEmailCode(data: SendEmailCodeForm) {
  return request<ApiResult>({
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

export function checkInviteCode(inviteCode: string) {
  return request<ApiResult>({
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

export function forgotPassword(data: ForgotPasswordForm) {
  return request<ApiResult>({
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
export function logout() {
  if (import.meta.env.VITE_APP_SSE === 'true') {
    request({
      url: '/resource/sse/close',
      method: 'get'
    });
  }
  return request({
    url: '/auth/logout',
    method: 'post'
  });
}

/**
 * 获取验证码
 */
export function getCodeImg() {
  return request<ApiResponse<VerifyCodeResult>>({
    url: '/auth/code',
    headers: {
      isToken: false
    },
    method: 'get',
    timeout: 20000
  });
}

// 获取用户详细信息
export function getInfo() {
  return request<ApiResponse<UserInfo>>({
    url: '/system/user/getInfo',
    method: 'get'
  });
}
