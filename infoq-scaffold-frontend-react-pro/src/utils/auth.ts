export const TOKEN_KEY = 'Admin-Token';

const canUseStorage = () => typeof localStorage !== 'undefined';

export const getToken = (): string =>
  canUseStorage() ? localStorage.getItem(TOKEN_KEY) || '' : '';

export const setToken = (token: string): void => {
  if (canUseStorage()) {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const removeToken = (): void => {
  if (canUseStorage()) {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const clearAuthState = (): void => {
  removeToken();
};
