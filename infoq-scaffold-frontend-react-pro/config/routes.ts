export default [
  {
    path: '/login',
    layout: false,
    component: './user/login',
  },
  {
    path: '/user/login',
    layout: false,
    redirect: '/login',
  },
  {
    path: '/register',
    layout: false,
    component: './register',
  },
  {
    path: '/forgot-password',
    layout: false,
    component: './forgot-password',
  },
  {
    path: '/oauth/callback',
    layout: false,
    component: './oauth-callback',
  },
  {
    path: '/401',
    layout: false,
    component: './error/401',
  },
  {
    path: '/redirect/*',
    component: './redirect',
  },
  {
    path: '/index',
    name: '首页',
    locale: false,
    icon: 'dashboard',
    component: './index',
  },
  {
    path: '/message-center',
    name: '消息中心',
    locale: false,
    component: './message-center',
  },
  {
    path: '/',
    redirect: '/index',
  },
  {
    path: '/404',
    component: './error/404',
    layout: false,
  },
  {
    path: '*',
    component: './BackendRouteView',
  },
];
