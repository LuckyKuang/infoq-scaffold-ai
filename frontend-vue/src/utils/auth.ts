let accessToken: string | null = null;

// 旧凭据只删除，不能读取后迁移到新的浏览器会话。
localStorage.removeItem('Admin-Token');

export const getToken = () => accessToken;
export const setToken = (token: string) => (accessToken = token);
export const removeToken = () => (accessToken = null);

const sessionEventKey = `infoq-browser-session:vue:${import.meta.env.VITE_APP_CLIENT_ID}`;
type SessionAction = 'changed' | 'logout';

export const notifySessionChange = (action: SessionAction) => {
  // 通知只含事件，不携带 token、cookie 或 CSRF 值。
  localStorage.setItem(sessionEventKey, JSON.stringify({ action }));
  localStorage.removeItem(sessionEventKey);
};

export const onSessionChange = (listener: (action: SessionAction) => void) => {
  const handler = (event: StorageEvent) => {
    if (event.key !== sessionEventKey || !event.newValue) return;
    let action: unknown;
    try {
      action = JSON.parse(event.newValue).action;
    } catch {
      return;
    }
    if (action === 'changed' || action === 'logout') listener(action);
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};
