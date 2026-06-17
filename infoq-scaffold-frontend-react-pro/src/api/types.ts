export interface ApiResult {
  code: number;
  msg?: string;
}

export interface ApiResponse<T> extends ApiResult {
  data: T;
}

export interface TableResponse<T> extends ApiResult {
  rows: T[];
  total: number;
}

/**
 * 注册
 */
export type RegisterForm = {
  email: string;
  emailCode?: string;
  inviteCode?: string;
  username: string;
  password: string;
  confirmPassword?: string;
  code?: string;
  uuid?: string;
};

export type ForgotPasswordForm = {
  email: string;
  emailCode?: string;
  newPassword: string;
  confirmPassword?: string;
  code?: string;
  uuid?: string;
};

export type SendEmailCodeForm = {
  email: string;
  scene: 'register' | 'forgot_password' | 'email_login';
  inviteCode?: string;
  code?: string;
  uuid?: string;
};

/**
 * 登录请求
 */
export interface LoginData {
  username?: string;
  password?: string;
  rememberMe?: boolean;
  source?: string;
  code?: string;
  uuid?: string;
  clientId: string;
  grantType: string;
}

/**
 * 登录响应
 */
export interface LoginResult {
  access_token: string;
}

export interface OAuthProviderOption {
  providerCode: string;
  providerName: string;
}

export interface OAuthTicketData {
  loginTicket: string;
  clientId?: string;
  grantType?: 'oauth';
}

/**
 * 验证码返回
 */
export interface VerifyCodeResult {
  captchaEnabled: boolean;
  uuid?: string;
  img?: string;
  registerEnabled?: boolean;
  inviteRegisterEnabled?: boolean;
  forgotPasswordEnabled?: boolean;
  mailEnabled?: boolean;
}
