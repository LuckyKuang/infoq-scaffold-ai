const TOKEN_KEY = 'Admin-Token';

export const getToken = (): string => localStorage.getItem(TOKEN_KEY) || '';

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};
