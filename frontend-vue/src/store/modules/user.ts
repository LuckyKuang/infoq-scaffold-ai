import { to } from 'await-to-js';
import { getToken, notifySessionChange, onSessionChange, removeToken, setToken } from '@/utils/auth';
import {
  bindBrowserSession,
  BrowserSessionError,
  clearBrowserSessionCsrf,
  deleteBrowserSession,
  exchangeOAuthTicket,
  getInfo as getUserInfo,
  login as loginApi,
  logout as logoutApi,
  restoreBrowserSession
} from '@/api/login';
import { LoginData } from '@/api/types';
import defAva from '@/assets/images/profile.jpg';
import { closeSSE } from '@/utils/sse';
import { closeWebSocket } from '@/utils/websocket';
import { usePermissionStore } from '@/store/modules/permission';
import { useTagsViewStore } from '@/store/modules/tagsView';
import { useNoticeStore } from '@/store/modules/notice';
import { defineStore } from 'pinia';
import { onScopeDispose, ref } from 'vue';

const ensureStringArray = (value: unknown, label: string) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} 必须是字符串数组`);
  }
  return value;
};

export const useUserStore = defineStore('user', () => {
  const token = ref(getToken());
  const name = ref('');
  const nickname = ref('');
  const userId = ref<string | number>('');
  const avatar = ref('');
  const roles = ref<Array<string>>([]); // 用户角色编码集合 → 判断路由权限
  const permissions = ref<Array<string>>([]); // 用户权限编码集合 → 判断按钮权限
  const bootstrapState = ref<'unknown' | 'restoring' | 'authenticated' | 'anonymous' | 'failed'>('unknown');
  const bootstrapError = ref('');
  const profileLoaded = ref(false);
  let bootstrapRequest: Promise<boolean> | null = null;
  let logoutRequest: Promise<void> | null = null;
  let sessionGeneration = 0;

  const acceptLogin = async (accessToken: string, generation: number) => {
    if (typeof accessToken !== 'string' || !accessToken) throw new Error('登录响应缺少 access_token');
    try {
      if (generation !== sessionGeneration) throw new Error('登录期间会话已发生变化，请重新登录');
      await bindBrowserSession(accessToken);
      if (generation !== sessionGeneration) throw new Error('登录期间会话已发生变化，请重新登录');
      notifySessionChange('changed');
    } catch (error) {
      clearBrowserSessionCsrf();
      try {
        await logoutApi(accessToken);
      } catch {
        throw new Error('浏览器会话绑定失败，且新登录会话撤销未确认，请重新登录并联系管理员');
      }
      throw error;
    }
    setToken(accessToken);
    token.value = accessToken;
    bootstrapState.value = 'authenticated';
  };

  /**
   * 登录
   * @param userInfo
   * @returns
   */
  const login = async (userInfo: LoginData): Promise<void> => {
    if (logoutRequest) await logoutRequest;
    clearLocalSession();
    bootstrapState.value = 'anonymous';
    const generation = sessionGeneration;
    const [err, res] = await to(loginApi(userInfo));
    if (res) {
      const data = res.data;
      await acceptLogin(data.access_token, generation);
      return Promise.resolve();
    }
    return Promise.reject(err);
  };

  const loginByOAuthTicket = async (loginTicket: string): Promise<void> => {
    if (logoutRequest) await logoutRequest;
    clearLocalSession();
    bootstrapState.value = 'anonymous';
    const generation = sessionGeneration;
    const [err, res] = await to(exchangeOAuthTicket({ loginTicket }));
    if (res) {
      const data = res.data;
      await acceptLogin(data.access_token, generation);
      return Promise.resolve();
    }
    return Promise.reject(err);
  };

  // 获取用户信息
  const getInfo = async (): Promise<void> => {
    const generation = sessionGeneration;
    const [err, res] = await to(getUserInfo());
    if (res) {
      if (generation !== sessionGeneration) return;
      const data = res.data;
      const user = data.user;
      const profile = user.avatar == '' || user.avatar == null ? defAva : user.avatar;
      const nextRoles = ensureStringArray(data.roles, '用户角色');
      const nextPermissions = ensureStringArray(data.permissions, '用户权限');
      roles.value = nextRoles;
      permissions.value = nextPermissions;
      name.value = user.userName;
      nickname.value = user.nickName;
      avatar.value = profile;
      userId.value = user.userId;
      profileLoaded.value = true;
      return Promise.resolve();
    }
    return Promise.reject(err);
  };

  const clearLocalSession = () => {
    sessionGeneration++;
    bootstrapRequest = null;
    closeSSE();
    closeWebSocket();
    usePermissionStore().resetRoutes();
    useTagsViewStore().resetSessionViews();
    useNoticeStore().clearNotice();
    token.value = '';
    roles.value = [];
    permissions.value = [];
    name.value = '';
    nickname.value = '';
    avatar.value = '';
    userId.value = '';
    profileLoaded.value = false;
    bootstrapError.value = '';
    removeToken();
  };

  const invalidateSession = () => {
    clearLocalSession();
    bootstrapState.value = 'anonymous';
  };

  const bootstrap = (): Promise<boolean> => {
    if (bootstrapRequest) return bootstrapRequest;
    if (bootstrapState.value === 'anonymous') return Promise.resolve(false);
    if (bootstrapState.value === 'failed') return Promise.reject(new Error(bootstrapError.value));
    if (token.value && profileLoaded.value) return Promise.resolve(false);
    const generation = sessionGeneration;
    bootstrapState.value = 'restoring';
    const pending = Promise.resolve().then(async () => {
      try {
        if (!token.value) {
          const data = await restoreBrowserSession();
          if (generation !== sessionGeneration) return false;
          setToken(data.access_token);
          token.value = data.access_token;
        }
        await getInfo();
        if (generation !== sessionGeneration) return false;
        const routes = await usePermissionStore().generateRoutes();
        if (generation !== sessionGeneration) return false;
        usePermissionStore().installRoutes(routes);
        bootstrapState.value = 'authenticated';
        return true;
      } catch (error) {
        if (generation !== sessionGeneration) return false;
        clearLocalSession();
        if (error instanceof BrowserSessionError && error.status === 401 && error.method === 'POST') {
          bootstrapState.value = 'anonymous';
          return false;
        }
        bootstrapState.value = 'failed';
        bootstrapError.value = error instanceof Error ? error.message : '会话恢复失败，请重试';
        throw error;
      } finally {
        if (bootstrapRequest === pending) bootstrapRequest = null;
      }
    });
    bootstrapRequest = pending;
    return pending;
  };

  const stopSessionListener = onSessionChange((action) => {
    clearLocalSession();
    clearBrowserSessionCsrf();
    bootstrapState.value = action === 'logout' ? 'anonymous' : 'unknown';
    // 交由守卫恢复新身份，不能让旧 DOM 继续使用已清空的权限。
    window.location.reload();
  });
  onScopeDispose(stopSessionListener);

  // 注销
  const logout = async (): Promise<void> => {
    if (logoutRequest) return logoutRequest;
    clearLocalSession();
    bootstrapState.value = 'anonymous';
    const pending = deleteBrowserSession();
    logoutRequest = pending;
    try {
      await pending;
    } catch {
      bootstrapError.value = '本地会话已清除，服务端注销未确认，请重试退出或联系管理员';
      throw new Error(bootstrapError.value);
    } finally {
      if (logoutRequest === pending) logoutRequest = null;
      notifySessionChange('logout');
    }
  };

  const setAvatar = (value: string) => {
    avatar.value = value;
  };

  return {
    userId,
    token,
    name,
    nickname,
    avatar,
    roles,
    permissions,
    bootstrapState,
    bootstrapError,
    profileLoaded,
    bootstrap,
    invalidateSession,
    login,
    loginByOAuthTicket,
    getInfo,
    logout,
    setAvatar
  };
});
