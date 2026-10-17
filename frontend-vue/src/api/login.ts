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
