import { create } from 'zustand';
import { exchangeOAuthTicket, getInfo as getUserInfo, login as loginApi, logout as logoutApi } from '@/api/login';
import type { LoginData } from '@/api/types';
import { getToken, removeToken, setToken } from '@/utils/auth';
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

const initializeRealtimeChannels = () => {
  initSSE(getRealtimeSSEUrl());
  initWebSocket(getRealtimeWebSocketUrl());
};

const applyLoginToken = (token: string, set: (state: Partial<UserState>) => void) => {
  setToken(token);
  set({ token });
  initializeRealtimeChannels();
};

const clearLocalSession = (set: (state: Partial<UserState>) => void) => {
  removeToken();
  set({ token: '', roles: [], permissions: [], name: '', nickname: '', avatar: '', userId: '' });
};

export const useUserStore = create<UserState>((set) => ({
  token: getToken(),
  name: '',
  nickname: '',
  userId: '',
  avatar: '',
  roles: [],
  permissions: [],
  login: async (userInfo) => {
    const res = await loginApi(userInfo);
    const token = res.data.access_token;
    applyLoginToken(token, set);
  },
  loginByOAuthTicket: async (loginTicket) => {
    const res = await exchangeOAuthTicket({ loginTicket });
    const token = res.data.access_token;
    applyLoginToken(token, set);
  },
  getInfo: async () => {
    const res = await getUserInfo();
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
  initializeRealtimeChannels,
  logout: async () => {
    closeSSE();
    closeWebSocket();
    try {
      await logoutApi();
    } finally {
      clearLocalSession(set);
    }
  },
  setAvatar: (value) => set({ avatar: value })
}));
