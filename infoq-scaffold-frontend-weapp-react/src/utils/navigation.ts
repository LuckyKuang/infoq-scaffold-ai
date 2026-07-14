import Taro from '@tarojs/taro';

export const routes = {
  login: '/pages/login/index',
  home: '/pages/home/index',
  admin: '/pages/admin/index',
  notices: '/pages/notices/index',
  messages: '/pages/messages/index',
  noticeDetail: '/pages/notice-detail/index',
  noticeForm: '/pages/notice-form/index',
  profile: '/pages/profile/index',
  profileEdit: '/pages/profile-edit/index',
  users: '/pages/system-users/index',
  userForm: '/pages/system-users/form/index',
  roles: '/pages/system-roles/index',
  roleForm: '/pages/system-roles/form/index',
  depts: '/pages/system-depts/index',
  deptForm: '/pages/system-depts/form/index',
  posts: '/pages/system-posts/index',
  postForm: '/pages/system-posts/form/index',
  menus: '/pages/system-menus/index',
  menuForm: '/pages/system-menus/form/index',
  dicts: '/pages/system-dicts/index',
  dictData: '/pages/system-dicts/data/index',
  online: '/pages/monitor-online/index',
  loginInfo: '/pages/monitor-login-info/index',
  operLog: '/pages/monitor-oper-log/index',
  cache: '/pages/monitor-cache/index'
} as const;

export const relaunch = (url: string) => Taro.reLaunch({ url });

export const navigate = (url: string) => Taro.navigateTo({ url });

export const backOr = (fallback: string) => {
  const pages = Taro.getCurrentPages();
  if (pages.length > 1) {
    Taro.navigateBack();
    return;
  }
  relaunch(fallback);
};
