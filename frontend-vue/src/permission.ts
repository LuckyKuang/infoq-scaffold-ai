import { to as tos } from 'await-to-js';
import router from './router';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import 'element-plus/es/components/message/style/css';
import { getToken } from '@/utils/auth';
import { isHttp, isPathMatch } from '@/utils/validate';
import { isRelogin } from '@/utils/request';
import { useUserStore } from '@/store/modules/user';
import { useSettingsStore } from '@/store/modules/settings';
import { usePermissionStore } from '@/store/modules/permission';
import { ElMessage } from 'element-plus/es/components/message/index';

NProgress.configure({ showSpinner: false });
const whiteList = [
  '/login',
  '/register',
  '/register*',
  '/register/*',
  '/forgot-password',
  '/forgot-password*',
  '/forgot-password/*',
  '/oauth/callback',
  '/oauth/callback*',
  '/oauth/callback/*'
];

const isWhiteList = (path: string) => {
  return whiteList.some((pattern) => isPathMatch(pattern, path));
};

router.beforeEach(async (to) => {
  NProgress.start();
  if (getToken()) {
    to.meta.title && useSettingsStore().setTitle(to.meta.title as string);
    /* has token*/
    if (to.path === '/login') {
      NProgress.done();
      return { path: '/' };
    } else if (isWhiteList(to.path)) {
      return true;
    } else {
      if (useUserStore().roles.length === 0) {
        isRelogin.show = true;
        // 判断当前用户是否已拉取完user_info信息
        const [err] = await tos(useUserStore().getInfo());
        if (err) {
          isRelogin.show = false;
          await useUserStore().logout();
          ElMessage.error(err);
          return { path: '/' };
        } else {
          isRelogin.show = false;
          const accessRoutes = await usePermissionStore().generateRoutes();
          // 根据roles权限生成可访问的路由表
          accessRoutes.forEach((route) => {
            if (!isHttp(route.path)) {
              router.addRoute(route); // 动态添加可访问路由表
            }
          });
          return to.fullPath;
        }
      } else {
        return true;
      }
    }
  } else {
    // 没有token
    if (isWhiteList(to.path)) {
      // 在免登录白名单，直接进入
      return true;
    } else {
      const redirect = encodeURIComponent(to.fullPath || '/');
      NProgress.done();
      return `/login?redirect=${redirect}`; // 否则全部重定向到登录页
    }
  }
});

router.afterEach(() => {
  NProgress.done();
});
