import {create} from 'zustand';
import {
  getInfo,
  getToken,
  getUnreadMessageCount,
  hasPermission as hasGrantedPermission,
  login,
  type LoginData,
  logout,
  normalizePermissions,
  removeToken,
  setToken,
  type UserInfo,
  type UserVO
} from '@/api';

type SessionState = {
  token: string;
  user: UserVO | null;
  permissions: string[];
  initialized: boolean;
  unreadMessageCount: number;
  loadSession: (force?: boolean) => Promise<UserInfo | null>;
  refreshUnreadMessageCount: () => Promise<void>;
  signIn: (payload: LoginData) => Promise<void>;
  signOut: () => Promise<void>;
  patchUser: (patch: Partial<UserVO>) => void;
  hasPermission: (permission: string) => boolean;
};

const clearSessionState = {
  token: '',
  user: null,
  permissions: [] as string[],
  initialized: true,
  unreadMessageCount: 0
};

const resolvePermissions = (value: unknown) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('用户权限必须是字符串数组');
  }
  return normalizePermissions(value);
};

export const useSessionStore = create<SessionState>((set, get) => ({
  token: getToken(),
  user: null,
  permissions: [],
  initialized: false,
  unreadMessageCount: 0,
  loadSession: async (force = false) => {
    const currentToken = getToken();
    if (!currentToken) {
      set({ ...clearSessionState });
      return null;
    }
    if (!force && get().initialized && get().user) {
      return {
        user: get().user as UserVO,
        roles: [],
        permissions: get().permissions
      };
    }
    const response = await getInfo();
    const info = response.data;
    set({
      token: currentToken,
      user: info.user,
      permissions: resolvePermissions(info.permissions),
      initialized: true
    });
    return info;
  },
  signIn: async (payload) => {
    const response = await login(payload);
    const token = response.data.access_token;
    setToken(token);
    set({ token });
    const infoResponse = await getInfo();
    const info = infoResponse.data;
    set({
      token,
      user: info.user,
      permissions: resolvePermissions(info.permissions),
      initialized: true
    });
  },
  refreshUnreadMessageCount: async () => {
    if (!getToken()) {
      set({ unreadMessageCount: 0 });
      return;
    }
    const response = await getUnreadMessageCount();
    set({ unreadMessageCount: response.data });
  },
  signOut: async () => {
    let logoutError: unknown;
    try {
      if (getToken()) {
        await logout();
      }
    } catch (error) {
      logoutError = error;
    }
    removeToken();
    set({ ...clearSessionState });
    if (logoutError) {
      throw logoutError;
    }
  },
  patchUser: (patch) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...patch } : { ...patch }
    }));
  },
  hasPermission: (permission) => hasGrantedPermission(get().permissions, permission)
}));
