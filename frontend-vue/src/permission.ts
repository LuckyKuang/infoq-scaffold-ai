import router from './router';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import 'element-plus/es/components/message/style/css';
import { getToken } from '@/utils/auth';
import { isPublicRoute } from '@/router/public-routes';
import { isRelogin } from '@/utils/request';
import { useUserStore } from '@/store/modules/user';
import { useSettingsStore } from '@/store/modules/settings';
import { ElMessage } from 'element-plus/es/components/message/index';

NProgress.configure({ showSpinner: false });

router.beforeEach(async (to) => {
  NProgress.start();
  // OAuth ticket 必须先绑定新身份，不能提前恢复旧用户或连接。
  if (to.path === '/oauth/callback' || to.path.startsWith('/oauth/callback/')) return true;
  if (isPublicRoute(to.path) && to.path !== '/login' && !getToken()) return true;
  let routesInstalled: boolean;
  try {
    isRelogin.show = true;
    routesInstalled = await useUserStore().bootstrap();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '会话恢复失败，请重试');
    NProgress.done();
    return false;
  } finally {
    isRelogin.show = false;
  }
  if (getToken()) {
    to.meta.title && useSettingsStore().setTitle(to.meta.title as string);
    /* has token*/
    if (to.path === '/login') {
      NProgress.done();
      return { path: '/' };
    } else if (isPublicRoute(to.path)) {
      return true;
    } else {
      return routesInstalled ? to.fullPath : true;
    }
  } else {
    // 没有token
    if (isPublicRoute(to.path)) {
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
