import type {MenuDataItem, Settings as LayoutSettings,} from '@ant-design/pro-components';
import {SettingDrawer} from '@ant-design/pro-components';
import type {RequestConfig, RunTimeLayoutConfig} from '@umijs/max';
import {history, Link} from '@umijs/max';
import {App as AntdApp} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';
import '@/lang';
import {
  AvatarDropdown,
  DocLink,
  ErrorBoundary,
  Footer,
  LangDropdown,
  LayoutTagsView,
  OfflineBanner,
} from '@/components';
import AntdAppBridge from '@/components/AntdAppBridge';
import SvgIcon from '@/components/SvgIcon';
import {
  assertNoRouteConflicts,
  buildRouteComponentMap,
  ensureStaticRoutes,
  filterAsyncRouter,
  normalizeSidebarRoutes,
  type ProMenuRoute,
  type RouteComponentMapItem,
  toProMenuRoutes,
  withAbsoluteRoutePaths,
} from '@/router/route-transform';
import {getInfo, getRouters} from '@/services/ant-design-pro/api';
import {useUserStore} from '@/store/modules/user';
import {clearAuthState, getToken} from '@/utils/auth';
import {setPermissionContext} from '@/utils/permission';
import {isPathMatch} from '@/utils/validate';
import defaultSettings from '../config/defaultSettings';
import {errorConfig} from './requestErrorConfig';

// Initialize dayjs plugins globally
dayjs.extend(relativeTime);

const loginPath = '/login';
const publicRoutePatterns = [
  '/login',
  '/login/*',
  '/user/login',
  '/register',
  '/register/*',
  '/forgot-password',
  '/forgot-password/*',
  '/oauth/callback',
  '/oauth/callback/*',
];
const defaultBaseApi =
  process.env.NODE_ENV === 'production' ? '/prod-api' : '/dev-api';
const appBaseApi = process.env.VITE_APP_BASE_API || defaultBaseApi;

type AuthBootstrapState = {
  currentUser: API.CurrentUser;
  roles: string[];
  permissions: string[];
  menuRoute: ProMenuRoute;
  routeComponentMap: Record<string, RouteComponentMapItem>;
};

type InitialState = {
  settings?: Partial<LayoutSettings>;
  currentUser?: API.CurrentUser;
  roles?: string[];
  permissions?: string[];
  menuRoute?: ProMenuRoute;
  routeComponentMap?: Record<string, RouteComponentMapItem>;
  loading?: boolean;
  fetchUserInfo?: () => Promise<AuthBootstrapState | undefined>;
  settingDrawerOpen?: boolean;
};

const isPublicRoute = (path: string) =>
  publicRoutePatterns.some((pattern) => isPathMatch(pattern, path));

const ensureStringArray = (value: unknown, label: string) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} 必须是字符串数组`);
  }
  return value as string[];
};

const cloneRouteList = (routes: API.AppRoute[]) => {
  if (!Array.isArray(routes)) {
    throw new Error('路由响应 data 必须是数组');
  }
  return JSON.parse(JSON.stringify(routes)) as API.AppRoute[];
};

const mapCurrentUser = (data: API.UserInfo): API.CurrentUser => {
  const roles = ensureStringArray(data.roles, '用户角色');
  const permissions = ensureStringArray(data.permissions, '用户权限');
  const user = data.user || {};
  const displayName = user.nickName || user.userName || 'User';
  return {
    name: displayName,
    nickname: user.nickName,
    avatar: user.avatar,
    userId: user.userId,
    userName: user.userName,
    email: user.email,
    phone: user.phonenumber,
    access: roles.includes('admin') ? 'admin' : roles[0],
    roles,
    permissions,
    profile: user,
  };
};

const buildMenuState = (appRoutes: API.AppRoute[]) => {
  const sdata = cloneRouteList(appRoutes);
  const rdata = cloneRouteList(appRoutes);
  const defaultData = cloneRouteList(appRoutes);
  const sidebarRoutes = ensureStaticRoutes(
    normalizeSidebarRoutes(withAbsoluteRoutePaths(filterAsyncRouter(sdata))),
  );
  const rewriteRoutes = ensureStaticRoutes(
    withAbsoluteRoutePaths(filterAsyncRouter(rdata, true)),
  );
  const defaultRoutes = ensureStaticRoutes(
    withAbsoluteRoutePaths(filterAsyncRouter(defaultData)),
  );

  assertNoRouteConflicts(rewriteRoutes);

  const routeComponentMap = {
    ...buildRouteComponentMap(defaultRoutes),
    ...buildRouteComponentMap(rewriteRoutes),
  };
  const menuRoutes = toProMenuRoutes(sidebarRoutes);
  return {
    routeComponentMap,
    menuRoute: {
      path: '/',
      routes: menuRoutes,
      children: menuRoutes,
    },
  };
};

const renderMenuIcon = (icon: MenuDataItem['icon'], title?: string) => {
  if (typeof icon !== 'string' || !icon || icon === '#') {
    return icon;
  }
  return <SvgIcon iconClass={icon} size={16} title={title || icon} />;
};

const renderBackendMenuIcons = (menuData: MenuDataItem[]): MenuDataItem[] =>
  menuData.map((item) => {
    const children = item.children
      ? renderBackendMenuIcons(item.children)
      : undefined;
    return {
      ...item,
      icon: renderMenuIcon(item.icon, item.name),
      children,
    };
  });

const syncLegacyUserState = (authState: AuthBootstrapState) => {
  setPermissionContext(authState.roles, authState.permissions);
  useUserStore.setState({
    token: getToken(),
    name: authState.currentUser.userName || authState.currentUser.name || '',
    nickname:
      authState.currentUser.nickname || authState.currentUser.name || '',
    userId: authState.currentUser.userId || '',
    avatar: authState.currentUser.avatar || '',
    roles: authState.roles,
    permissions: authState.permissions,
  });
};

const fetchAuthBootstrapState = async (): Promise<AuthBootstrapState> => {
  const [userInfoRes, routerRes] = await Promise.all([getInfo(), getRouters()]);
  const roles = ensureStringArray(userInfoRes.data.roles, '用户角色');
  const permissions = ensureStringArray(
    userInfoRes.data.permissions,
    '用户权限',
  );
  const authState = {
    currentUser: mapCurrentUser(userInfoRes.data),
    roles,
    permissions,
    ...buildMenuState(routerRes.data),
  };
  syncLegacyUserState(authState);
  return authState;
};

/**
 * @see https://umijs.org/docs/api/runtime-config#getinitialstate
 * */
export async function getInitialState(): Promise<InitialState> {
  const fetchUserInfo = async () => {
    try {
      return await fetchAuthBootstrapState();
    } catch (_error) {
      clearAuthState();
      const { pathname, search, hash } = history.location;
      history.replace(
        `${loginPath}?redirect=${encodeURIComponent(pathname + search + hash)}`,
      );
    }
    return undefined;
  };
  // 如果不是登录页面，执行
  const { location } = history;
  if (!isPublicRoute(location.pathname) && getToken()) {
    const authState = await fetchUserInfo();
    return {
      fetchUserInfo,
      ...authState,
      settings: defaultSettings as Partial<LayoutSettings>,
      settingDrawerOpen: false,
    };
  }
  return {
    fetchUserInfo,
    settings: defaultSettings as Partial<LayoutSettings>,
    settingDrawerOpen: false,
  };
}

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  return {
    menuItemRender: (item, dom) => {
      if (item.path) {
        return (
          <Link to={item.path} prefetch>
            {dom}
          </Link>
        );
      }
      return dom;
    },
    actionsRender: () => {
      // `locale: false` opts out of the language switcher. ProLayout's own
      // `locale` prop is a locale string, so narrow to the boolean toggle here.
      const localeEnabled =
        (initialState?.settings as { locale?: boolean })?.locale !== false;
      return [
        <DocLink key="doc" />,
        localeEnabled && <LangDropdown key="lang" />,
      ].filter(Boolean);
    },
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      title: initialState?.currentUser?.name || 'User',
      render: (_, avatarChildren) => (
        <AvatarDropdown>{avatarChildren}</AvatarDropdown>
      ),
    },
    // waterMarkProps: {
    //   content: initialState?.currentUser?.name,
    // },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      // 如果没有登录，重定向到 login
      if (!getToken() && !isPublicRoute(location.pathname)) {
        history.replace(
          `${loginPath}?redirect=${encodeURIComponent(location.pathname + location.search + location.hash)}`,
        );
      }
    },
    route: initialState?.menuRoute,
    menuDataRender: renderBackendMenuIcons,
    // Replace ProLayout's default ErrorBoundary with our offline-aware version,
    // so chunk load errors show friendly messages instead of "Something went wrong."
    ErrorBoundary,
    menuHeaderRender: undefined,
    // 自定义 403 页面
    // unAccessible: <div>unAccessible</div>,
    // 增加一个 loading 的状态
    childrenRender: (children) => {
      // if (initialState?.loading) return <PageLoading />;
      return (
        <>
          <LayoutTagsView />
          {children}
          <SettingDrawer
            disableUrlParams
            enableDarkTheme
            collapse={initialState?.settingDrawerOpen}
            onCollapseChange={(open) => {
              setInitialState((s) => ({
                ...s,
                settingDrawerOpen: open,
              }));
            }}
            settings={initialState?.settings}
            onSettingChange={(settings) => {
              setInitialState((s) => ({
                ...s,
                settings,
              }));
            }}
          />
        </>
      );
    },
    ...initialState?.settings,
  };
};

/**
 * @name request 配置，可以配置错误处理
 * 它基于 axios 提供了一套统一的网络请求和错误处理方案。
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request: RequestConfig = {
  baseURL: appBaseApi,
  ...errorConfig,
};

export function rootContainer(container: React.ReactNode) {
  return (
    <AntdApp>
      <AntdAppBridge />
      <OfflineBanner />
      <ErrorBoundary>{container}</ErrorBoundary>
    </AntdApp>
  );
}
