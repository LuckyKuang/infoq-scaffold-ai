let navigator: ((path: string) => void) | null = null;
// 路由层当前位置（已去除 basename，含 search/hash），供 React 之外的请求拦截器构造登录 redirect
let currentFullPath = '/';

export const setCurrentFullPath = (fullPath: string) => {
  currentFullPath = fullPath;
};

export const getCurrentFullPath = () => currentFullPath;

export const setNavigator = (fn: (path: string) => void) => {
  navigator = fn;
};

export const navigateTo = (path: string) => {
  navigator?.(path);
};
