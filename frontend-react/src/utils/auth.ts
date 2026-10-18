let accessToken = '';

// 清理旧版本的持久凭据；恢复身份仅由受保护的 HttpOnly 会话入口提供。
localStorage.removeItem('Admin-Token');
sessionStorage.removeItem('Admin-Token');

export const getToken = (): string => accessToken;

export const setToken = (token: string): void => {
  accessToken = token;
};

export const removeToken = (): void => {
  accessToken = '';
};
