// @ts-ignore
/* eslint-disable */

declare namespace API {
  type ApiResult = {
    code: number;
    msg?: string;
  };

  type ApiResponse<T> = ApiResult & {
    data: T;
  };

  type TableResponse<T> = ApiResult & {
    rows: T[];
    total: number;
  };

  type UserProfile = {
    userId?: string | number;
    userName?: string;
    nickName?: string;
    avatar?: string;
    email?: string;
    phonenumber?: string;
    sex?: string;
    dept?: unknown;
    roles?: unknown[];
    [key: string]: unknown;
  };

  type UserInfo = {
    user: UserProfile;
    roles: string[];
    permissions: string[];
  };

  type CurrentUser = {
    name?: string;
    nickname?: string;
    avatar?: string;
    userid?: string;
    userId?: string | number;
    userName?: string;
    email?: string;
    signature?: string;
    title?: string;
    group?: string;
    tags?: { key?: string; label?: string }[];
    notifyCount?: number;
    unreadCount?: number;
    country?: string;
    access?: string;
    geographic?: {
      province?: { label?: string; key?: string };
      city?: { label?: string; key?: string };
    };
    address?: string;
    phone?: string;
    roles?: string[];
    permissions?: string[];
    profile?: UserProfile;
  };

  type LoginResult = {
    access_token: string;
  };

  type VerifyCodeResult = {
    captchaEnabled: boolean;
    uuid?: string;
    img?: string;
    registerEnabled?: boolean;
    inviteRegisterEnabled?: boolean;
    forgotPasswordEnabled?: boolean;
    mailEnabled?: boolean;
  };

  type OAuthProviderOption = {
    providerCode: string;
    providerName: string;
  };

  type OAuthTicketData = {
    loginTicket: string;
    clientId?: string;
    grantType?: 'oauth';
  };

  type RegisterForm = {
    email: string;
    emailCode?: string;
    inviteCode?: string;
    username: string;
    password: string;
    confirmPassword?: string;
    code?: string;
    uuid?: string;
  };

  type ForgotPasswordForm = {
    email: string;
    emailCode?: string;
    newPassword: string;
    confirmPassword?: string;
    code?: string;
    uuid?: string;
  };

  type SendEmailCodeForm = {
    email: string;
    scene: 'register' | 'forgot_password' | 'email_login';
    inviteCode?: string;
    code?: string;
    uuid?: string;
  };

  type RouteMeta = {
    title?: string;
    icon?: string;
    affix?: boolean;
    noCache?: boolean;
    link?: string;
    activeMenu?: string;
    breadcrumb?: boolean;
  };

  type AppRoute = {
    path: string;
    name?: string;
    hidden?: boolean | string | number;
    permissions?: string[];
    roles?: string[];
    alwaysShow?: boolean;
    query?: string;
    parentPath?: string;
    redirect?: string;
    component?: string;
    meta?: RouteMeta;
    children?: AppRoute[];
  };

  type PageParams = {
    current?: number;
    pageSize?: number;
  };

  type LoginParams = {
    username?: string;
    password?: string;
    rememberMe?: boolean;
    code?: string;
    uuid?: string;
    clientId?: string;
    grantType?: string;
  };

  type ErrorResponse = {
    /** 业务约定的错误码 */
    errorCode: string;
    /** 业务上的错误信息 */
    errorMessage?: string;
    /** 业务上的请求是否成功 */
    success?: boolean;
  };
}
