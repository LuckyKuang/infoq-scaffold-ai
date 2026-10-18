import { type ComponentType, lazy, type LazyExoticComponent } from 'react';

const NotFoundPage = lazy(() => import('@/pages/error/404'));

const componentMap: Record<string, LazyExoticComponent<ComponentType>> = {
  'index': lazy(() => import('@/pages/index')),
  'monitor/cache/index': lazy(() => import('@/pages/monitor/cache/index')),
  'monitor/dataSource/index': lazy(() => import('@/pages/monitor/dataSource/index')),
  'monitor/job/index': lazy(() => import('@/pages/monitor/job/index')),
  'monitor/jobLog/index': lazy(() => import('@/pages/monitor/jobLog/index')),
  'monitor/loginInfo/index': lazy(() => import('@/pages/monitor/loginInfo/index')),
  'monitor/online/index': lazy(() => import('@/pages/monitor/online/index')),
  'monitor/operLog/index': lazy(() => import('@/pages/monitor/operLog/index')),
  'monitor/operLog/oper-info-dialog': lazy(() => import('@/pages/monitor/operLog/oper-info-dialog')),
  'monitor/server/index': lazy(() => import('@/pages/monitor/server/index')),
  'system/client/index': lazy(() => import('@/pages/system/client/index')),
  'system/config/index': lazy(() => import('@/pages/system/config/index')),
  'system/dept/index': lazy(() => import('@/pages/system/dept/index')),
  'system/dict/data': lazy(() => import('@/pages/system/dict/data')),
  'system/dict/index': lazy(() => import('@/pages/system/dict/index')),
  'system/invite/index': lazy(() => import('@/pages/system/invite/index')),
  'system/menu/index': lazy(() => import('@/pages/system/menu/index')),
  'system/notice/index': lazy(() => import('@/pages/system/notice/index')),
  'system/oss/config': lazy(() => import('@/pages/system/oss/config')),
  'system/oss/index': lazy(() => import('@/pages/system/oss/index')),
  'system/post/index': lazy(() => import('@/pages/system/post/index')),
  'system/role/authUser': lazy(() => import('@/pages/system/role/authUser')),
  'system/role/index': lazy(() => import('@/pages/system/role/index')),
  'system/role/selectUser': lazy(() => import('@/pages/system/role/selectUser')),
  'system/user/authRole': lazy(() => import('@/pages/system/user/authRole')),
  'system/user/index': lazy(() => import('@/pages/system/user/index')),
  'system/user/profile/index': lazy(() => import('@/pages/system/user/profile/index')),
  'system/user/profile/onlineDevice': lazy(() => import('@/pages/system/user/profile/onlineDevice')),
  'system/user/profile/resetPwd': lazy(() => import('@/pages/system/user/profile/resetPwd')),
  'system/user/profile/userAvatar': lazy(() => import('@/pages/system/user/profile/userAvatar')),
  'system/user/profile/userInfo': lazy(() => import('@/pages/system/user/profile/userInfo'))
};

export const resolvePageComponent = (component?: string) => {
  if (!component) {
    return NotFoundPage;
  }
  return componentMap[component] || NotFoundPage;
};

export default componentMap;
