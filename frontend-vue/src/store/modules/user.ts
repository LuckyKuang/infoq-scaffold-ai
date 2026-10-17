import { to } from 'await-to-js';
import { getToken, removeToken, setToken } from '@/utils/auth';
import { exchangeOAuthTicket, getInfo as getUserInfo, login as loginApi, logout as logoutApi } from '@/api/login';
import { LoginData } from '@/api/types';
import defAva from '@/assets/images/profile.jpg';
import { closeSSE } from '@/utils/sse';
import { defineStore } from 'pinia';
import { ref } from 'vue';

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

  /**
   * 登录
   * @param userInfo
   * @returns
   */
  const login = async (userInfo: LoginData): Promise<void> => {
    const [err, res] = await to(loginApi(userInfo));
    if (res) {
      const data = res.data;
      setToken(data.access_token);
      token.value = data.access_token;
      return Promise.resolve();
    }
    return Promise.reject(err);
  };

  const loginByOAuthTicket = async (loginTicket: string): Promise<void> => {
    const [err, res] = await to(exchangeOAuthTicket({ loginTicket }));
    if (res) {
      const data = res.data;
      setToken(data.access_token);
      token.value = data.access_token;
      return Promise.resolve();
    }
    return Promise.reject(err);
  };

  // 获取用户信息
  const getInfo = async (): Promise<void> => {
    const [err, res] = await to(getUserInfo());
    if (res) {
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
      return Promise.resolve();
    }
    return Promise.reject(err);
  };

  const clearLocalSession = () => {
    token.value = '';
    roles.value = [];
    permissions.value = [];
    name.value = '';
    nickname.value = '';
    avatar.value = '';
    userId.value = '';
    removeToken();
  };

  // 注销
  const logout = async (): Promise<void> => {
    // 先关闭前端SSE连接，防止旧连接在退出后继续重连
    closeSSE();
    try {
      await logoutApi();
    } finally {
      clearLocalSession();
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
    login,
    loginByOAuthTicket,
    getInfo,
    logout,
    setAvatar
  };
});
