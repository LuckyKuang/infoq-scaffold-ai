import { create } from 'zustand';
import { exchangeOAuthTicket, getInfo as getUserInfo, login as loginApi, logout as logoutApi } from '@/api/login';
import type { LoginData } from '@/api/types';
import { getToken, removeToken, setToken } from '@/utils/auth';
import { bindBrowserSession, BrowserSessionError, clearBrowserSessionCsrf, deleteBrowserSession, restoreBrowserSession } from '@/api/browser-session';
import { usePermissionStore } from '@/store/modules/permission';
import { useNoticeStore } from '@/store/modules/notice';
import { useTagsViewStore } from '@/store/modules/tagsView';
import { closeSSE, initSSE } from '@/utils/sse';
import { closeWebSocket, initWebSocket } from '@/utils/websocket';
import defaultAvatar from '@/assets/images/profile.jpg';

const ensureStringArray = (value: unknown, label: string) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} 必须是字符串数组`);
  }
  return value;
};

export type UserState = {
  sessionState: 'unknown' | 'restoring' | 'authenticated' | 'anonymous' | 'failed';
  sessionError: string;
  logoutState: 'idle' | 'pending' | 'failed';
  bootstrapReady: boolean;
  token: string;
  name: string;
  nickname: string;
  userId: string | number;
  avatar: string;
  roles: string[];
  permissions: string[];
  login: (userInfo: LoginData) => Promise<void>;
  loginByOAuthTicket: (loginTicket: string) => Promise<void>;
  getInfo: () => Promise<void>;
  initializeRealtimeChannels: () => void;
  bootstrapSession: (retry?: boolean) => Promise<void>;
  invalidateSession: () => void;
  logout: () => Promise<void>;
  setAvatar: (value: string) => void;
};

const getRealtimeSSEUrl = () => `${import.meta.env.VITE_APP_BASE_API}/resource/sse`;

const getRealtimeWebSocketUrl = () => {
  const baseApi = import.meta.env.VITE_APP_BASE_API;
  if (typeof window === 'undefined' || !window.location?.host) {
    return `${baseApi}/resource/websocket`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  return `${protocol}${window.location.host}${baseApi}/resource/websocket`;
};

let sessionVersion = 0;
let bootstrapRequest: Promise<void> | undefined;
let logoutRequest: Promise<void> | undefined;
const notificationKey = 'infoq:browser-session:react';

const notifySessionChange = (action: 'bound' | 'logout') => {
  localStorage.setItem(notificationKey, JSON.stringify({ scope: 'react', clientId: import.meta.env.VITE_APP_CLIENT_ID, action }));
  localStorage.removeItem(notificationKey);
};

const clearLocalSession = (set: (state: Partial<UserState>) => void) => {
  closeSSE();
  closeWebSocket();
  removeToken();
  usePermissionStore.setState({ routes: [], addRoutes: [], defaultRoutes: [], topbarRouters: [], sidebarRouters: [], routeComponentMap: {} });
  useNoticeStore.getState().clearNotices();
  useTagsViewStore.setState({ visitedViews: [], cachedViews: [] });
  set({ token: '', roles: [], permissions: [], name: '', nickname: '', avatar: '', userId: '', bootstrapReady: false });
};

const bindLoginToken = async (token: string, version: number, set: (state: Partial<UserState>) => void) => {
  try {
    if (!token) throw new Error('登录响应缺少 access_token');
    if (version !== sessionVersion) throw new Error('登录已被取消，请重新登录');
    await bindBrowserSession(token);
    if (version !== sessionVersion) throw new Error('登录已被取消，请重新登录');
    setToken(token);
    set({ token, sessionState: 'authenticated', sessionError: '', bootstrapReady: false, logoutState: 'idle' });
    notifySessionChange('bound');
  } catch (error) {
    if (version === sessionVersion) {
      clearLocalSession(set);
      set({ sessionState: 'failed', sessionError: error instanceof Error ? error.message : '登录会话绑定失败' });
    }
    if (token) {
      try {
        await logoutApi(token);
      } catch {
        throw new Error('登录会话绑定失败，且新会话撤销未获确认，请联系管理员');
      }
    }
    throw error;
  }
};

export const useUserStore = create<UserState>((set, get) => ({
  sessionState: 'unknown',
  sessionError: '',
  logoutState: 'idle',
  bootstrapReady: false,
  token: getToken(),
  name: '',
  nickname: '',
  userId: '',
  avatar: '',
  roles: [],
  permissions: [],
  login: async (userInfo) => {
    const version = ++sessionVersion;
    bootstrapRequest = undefined;
    clearLocalSession(set);
    const res = await loginApi(userInfo);
    const token = res.data.access_token;
    await bindLoginToken(token, version, set);
  },
  loginByOAuthTicket: async (loginTicket) => {
    const version = ++sessionVersion;
    bootstrapRequest = undefined;
    clearLocalSession(set);
    const res = await exchangeOAuthTicket({ loginTicket });
    const token = res.data.access_token;
    await bindLoginToken(token, version, set);
  },
  getInfo: async () => {
    const version = sessionVersion;
    const res = await getUserInfo();
    if (version !== sessionVersion) return;
    const data = res.data;
    const user = data.user;
    const roles = ensureStringArray(data.roles, '用户角色');
    const permissions = ensureStringArray(data.permissions, '用户权限');
    set({
      roles,
      permissions,
      name: user.userName,
      nickname: user.nickName,
      avatar: user.avatar || defaultAvatar,
      userId: user.userId
    });
  },
  initializeRealtimeChannels: () => {
    if (!get().bootstrapReady || !getToken()) return;
    initSSE(getRealtimeSSEUrl());
    initWebSocket(getRealtimeWebSocketUrl());
  },
  bootstrapSession: (retry = false) => {
    if (get().logoutState !== 'idle') return Promise.reject(new Error(get().sessionError || '退出处理中，请等待完成'));
    if (bootstrapRequest) return bootstrapRequest;
    if (get().bootstrapReady || (get().sessionState === 'anonymous' && !retry)) return Promise.resolve();
    if (get().sessionState === 'failed' && !retry) return Promise.reject(new Error(get().sessionError));
    const version = sessionVersion;
    set({ sessionState: 'restoring', sessionError: '' });
    const pending = (async () => {
      try {
        if (!getToken()) {
          const restored = await restoreBrowserSession();
          if (version !== sessionVersion) return;
          setToken(restored.access_token);
          set({ token: restored.access_token });
        }
        await get().getInfo();
        if (version !== sessionVersion) return;
        await usePermissionStore.getState().generateRoutes(() => version === sessionVersion);
        if (version !== sessionVersion) return;
        set({ sessionState: 'authenticated', bootstrapReady: true });
        get().initializeRealtimeChannels();
      } catch (error) {
        if (version !== sessionVersion) return;
        clearLocalSession(set);
        if (error instanceof BrowserSessionError && error.status === 401 && error.method === 'post') {
          set({ sessionState: 'anonymous', sessionError: '' });
          return;
        }
        clearBrowserSessionCsrf();
        set({ sessionState: 'failed', sessionError: error instanceof Error ? error.message : '会话初始化失败，请重试' });
        throw error;
      } finally {
        if (bootstrapRequest === pending) bootstrapRequest = undefined;
      }
    })();
    bootstrapRequest = pending;
    return pending;
  },
  invalidateSession: () => {
    sessionVersion++;
    bootstrapRequest = undefined;
    clearBrowserSessionCsrf();
    clearLocalSession(set);
    set({ sessionState: 'anonymous', sessionError: '' });
  },
  logout: () => {
    if (logoutRequest) return logoutRequest;
    set({ logoutState: 'pending', sessionError: '' });
    get().invalidateSession();
    const pending = (async () => {
      try {
        await deleteBrowserSession();
        set({ logoutState: 'idle', sessionState: 'anonymous', sessionError: '' });
      } catch (error) {
        set({ logoutState: 'failed', sessionError: '退出未完成，服务端会话撤销未获确认，请重试退出' });
        throw error;
      } finally {
        if (logoutRequest === pending) logoutRequest = undefined;
        notifySessionChange('logout');
      }
    })();
    logoutRequest = pending;
    return pending;
  },
  setAvatar: (value) => set({ avatar: value })
}));

window.addEventListener('storage', (event) => {
  if (event.key !== notificationKey || !event.newValue) return;
  let change: { scope?: string; clientId?: string; action?: string };
  try {
    change = JSON.parse(event.newValue);
  } catch {
    return;
  }
  if (!change || typeof change !== 'object') return;
  if (
    change.scope === 'react' &&
    change.clientId === import.meta.env.VITE_APP_CLIENT_ID &&
    (change.action === 'bound' || change.action === 'logout')
  ) {
    useUserStore.getState().invalidateSession();
  }
});
