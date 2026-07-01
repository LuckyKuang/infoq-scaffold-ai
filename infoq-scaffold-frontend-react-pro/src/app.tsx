import type {MenuDataItem, ProLayoutProps, Settings as LayoutSettings,} from '@ant-design/pro-components';
import type {RequestConfig, RunTimeLayoutConfig} from '@umijs/max';
import {history, Link, useLocation} from '@umijs/max';
import type {BreadcrumbProps} from 'antd';
import {App as AntdApp, ConfigProvider, theme as antdTheme} from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import React, {lazy, Suspense, useEffect, useMemo} from 'react';
import AntdAppBridge from '@/components/AntdAppBridge';
import ErrorBoundary from '@/components/ErrorBoundary';
import InfoQGit from '@/components/InfoQGit';
import KeepAliveView from '@/components/KeepAliveView';
import LangSelect from '@/components/LangSelect';
import LayoutTagsView from '@/components/LayoutTagsView';
import OfflineBanner from '@/components/OfflineBanner';
import ScreenFull from '@/components/ScreenFull';
import SizeSelect from '@/components/SizeSelect';
import SvgIcon from '@/components/SvgIcon';
import TopNav from '@/components/TopNav';
import i18n from '@/lang';
import {
  assertNoRouteConflicts,
  buildRouteComponentMap,
  ensureStaticRoutes,
  filterAsyncRouter,
  normalizeSidebarRoutes,
  type ProMenuRoute,
  resolveRoutePath,
  type RouteComponentMapItem,
  toProMenuRoutes,
  withAbsoluteRoutePaths,
} from '@/router/route-transform';
import {getInfo, getRouters} from '@/services/ant-design-pro/api';
import {useAppStore} from '@/store/modules/app';
import {usePermissionStore} from '@/store/modules/permission';
import {useSettingsStore} from '@/store/modules/settings';
import {useUserStore} from '@/store/modules/user';
import type {AppRoute} from '@/types/router';
import {getToken} from '@/utils/auth';
import modal from '@/utils/modal';
import {setPermissionContext} from '@/utils/permission';
import {isPathMatch} from '@/utils/validate';
import defaultSettings from '../config/defaultSettings';
import {errorConfig} from './requestErrorConfig';

// Initialize dayjs plugins globally
dayjs.extend(relativeTime);
NProgress.configure({ showSpinner: false });

const SearchMenu = lazy(() => import('@/components/SearchMenu'));
const NoticeBell = lazy(() => import('@/components/NoticeBell'));
const SettingsDrawer = lazy(() => import('@/components/SettingsDrawer'));
const AvatarDropdown = lazy(() =>
  import('@/components/RightContent/AvatarDropdown').then((module) => ({
    default: module.AvatarDropdown,
  })),
);

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
  permissionState: {
    routes: AppRoute[];
    addRoutes: AppRoute[];
    defaultRoutes: AppRoute[];
    topbarRouters: AppRoute[];
    sidebarRouters: AppRoute[];
    routeComponentMap: Record<string, RouteComponentMapItem>;
  };
};

type InitialState = {
  settings?: RuntimeLayoutSettings;
  currentUser?: API.CurrentUser;
  roles?: string[];
  permissions?: string[];
  menuRoute?: ProMenuRoute;
  routeComponentMap?: Record<string, RouteComponentMapItem>;
  permissionState?: AuthBootstrapState['permissionState'];
  loading?: boolean;
  fetchUserInfo?: () => Promise<AuthBootstrapState | undefined>;
  settingDrawerOpen?: boolean;
};

type RuntimeLayoutSettings = Partial<LayoutSettings> & Partial<ProLayoutProps>;

type LegacyLayoutSnapshot = ReturnType<typeof useSettingsStore.getState>;
type LegacyAppSnapshot = ReturnType<typeof useAppStore.getState>;

const legacyLayoutSettingKeys = [
  'colorPrimary',
  'collapsed',
  'fixedHeader',
  'fixSiderbar',
  'layout',
  'logo',
  'menuRender',
  'navTheme',
  'title',
] as const;

const isPublicRoute = (path: string) =>
  publicRoutePatterns.some((pattern) => isPathMatch(pattern, path));

const normalizePath = (path: string) =>
  path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

const getRouteByPath = (
  routeComponentMap: Record<string, RouteComponentMapItem> | undefined,
  pathname: string,
) => {
  const currentPath = normalizePath(pathname);
  const map = routeComponentMap || {};
  return (
    map[currentPath] ||
    map[resolveRoutePath(currentPath)] ||
    map[`${currentPath}/index`]
  );
};

const toLegacyProLayoutSettings = (
  settings: LegacyLayoutSnapshot = useSettingsStore.getState(),
  app: LegacyAppSnapshot = useAppStore.getState(),
): RuntimeLayoutSettings => {
  const topNavActive = settings.topNav && app.device === 'desktop';
  return {
    colorPrimary: settings.theme,
    collapsed: !app.sidebarOpened,
    fixedHeader: settings.fixedHeader,
    fixSiderbar: true,
    layout: topNavActive ? 'top' : defaultSettings.layout,
    logo: settings.sidebarLogo ? defaultSettings.logo : false,
    menuRender: topNavActive || app.sidebarHide ? false : undefined,
    navTheme:
      settings.dark || settings.sideTheme !== 'theme-light'
        ? 'realDark'
        : 'light',
    title: process.env.VITE_APP_LOGO_TITLE || settings.title,
  };
};

const getInitialLayoutSettings = () => ({
  ...(defaultSettings as RuntimeLayoutSettings),
  ...toLegacyProLayoutSettings(),
});

const hasSameLegacyLayoutSettings = (
  current: RuntimeLayoutSettings | undefined,
  next: RuntimeLayoutSettings,
) => legacyLayoutSettingKeys.every((key) => current?.[key] === next[key]);

const findBreadcrumbRouteChain = (
  routes: AppRoute[],
  targetPath: string,
  parents: AppRoute[] = [],
): AppRoute[] => {
  const normalizedTargetPath = normalizePath(targetPath);

  for (const route of routes) {
    const normalizedRoutePath = normalizePath(route.path);
    const chain = [...parents, route];

    if (normalizedRoutePath === normalizedTargetPath) {
      return chain;
    }

    if (route.children && route.children.length > 0) {
      const childChain = findBreadcrumbRouteChain(
        route.children,
        normalizedTargetPath,
        chain,
      );
      if (childChain.length > 0) {
        return childChain;
      }
    }
  }

  return [];
};

const buildBreadcrumbItems = (
  routes: AppRoute[],
  pathname: string,
  currentRoute?: RouteComponentMapItem,
): BreadcrumbProps['items'] => {
  const activeMenuPath = currentRoute?.meta?.activeMenu;
  const lookupPath = normalizePath(activeMenuPath || pathname);
  const matchedRoutes = findBreadcrumbRouteChain(routes, lookupPath).filter(
    (route) => route.meta?.title && route.meta?.breadcrumb !== false,
  );
  const items = matchedRoutes.map((route) => ({
    path: route.path,
    title: route.meta?.title || route.name || route.path,
  }));

  if (lookupPath === '/index') {
    return items.length > 0 ? items : [{ path: '/index', title: '首页' }];
  }

  if (items.length === 0 || items[0].title !== '首页') {
    items.unshift({ path: '/index', title: '首页' });
  }

  const currentTitle = currentRoute?.meta?.title;
  if (
    currentTitle &&
    currentTitle !== items[items.length - 1]?.title &&
    currentRoute?.meta?.breadcrumb !== false
  ) {
    items.push({
      path: pathname,
      title: currentTitle,
    });
  }

  return items;
};

const getLegacyPageTitle = (
  initialState: InitialState | undefined,
  pathname: string,
) => {
  const settings = useSettingsStore.getState();
  const routeTitle = getRouteByPath(initialState?.routeComponentMap, pathname)
    ?.meta?.title;
  return settings.dynamicTitle && routeTitle
    ? `${routeTitle} - ${settings.title}`
    : settings.title;
};

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
    permissionState: {
      addRoutes: rewriteRoutes as AppRoute[],
      routes: rewriteRoutes as AppRoute[],
      sidebarRouters: sidebarRoutes as AppRoute[],
      defaultRoutes: defaultRoutes as AppRoute[],
      topbarRouters: defaultRoutes as AppRoute[],
      routeComponentMap,
    },
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
  usePermissionStore.setState(authState.permissionState);
  useUserStore.getState().initializeRealtimeChannels();
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
    } catch (error) {
      modal.msgError(error);
      try {
        await useUserStore.getState().logout();
      } catch (logoutError) {
        modal.msgError(logoutError);
      }
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
      settings: getInitialLayoutSettings(),
      settingDrawerOpen: false,
    };
  }
  return {
    fetchUserInfo,
    settings: getInitialLayoutSettings(),
    settingDrawerOpen: false,
  };
}

type LayoutRuntimeShellProps = {
  children: React.ReactNode;
  initialState?: InitialState;
  setInitialState: (callback: (state: InitialState) => InitialState) => void;
};

const LayoutRuntimeShell: React.FC<LayoutRuntimeShellProps> = ({
  children,
  initialState,
  setInitialState,
}) => {
  const location = useLocation();
  const themeColor = useSettingsStore((state) => state.theme);
  const sideTheme = useSettingsStore((state) => state.sideTheme);
  const topNav = useSettingsStore((state) => state.topNav);
  const fixedHeader = useSettingsStore((state) => state.fixedHeader);
  const sidebarLogo = useSettingsStore((state) => state.sidebarLogo);
  const dynamicTitle = useSettingsStore((state) => state.dynamicTitle);
  const dark = useSettingsStore((state) => state.dark);
  const title = useSettingsStore((state) => state.title);
  const sidebarOpened = useAppStore((state) => state.sidebarOpened);
  const sidebarHide = useAppStore((state) => state.sidebarHide);
  const device = useAppStore((state) => state.device);
  const openSideBar = useAppStore((state) => state.openSideBar);
  const closeSideBar = useAppStore((state) => state.closeSideBar);
  const toggleDevice = useAppStore((state) => state.toggleDevice);
  const currentPath = normalizePath(location.pathname);
  const currentRoute = getRouteByPath(
    initialState?.routeComponentMap,
    currentPath,
  );

  useEffect(() => {
    const syncDevice = () => {
      const nextDevice = window.innerWidth < 992 ? 'mobile' : 'desktop';
      toggleDevice(nextDevice);
      if (nextDevice === 'mobile') {
        closeSideBar();
      } else if (!useAppStore.getState().sidebarOpened) {
        openSideBar();
      }
    };

    syncDevice();
    window.addEventListener('resize', syncDevice);
    return () => {
      window.removeEventListener('resize', syncDevice);
    };
  }, [closeSideBar, openSideBar, toggleDevice]);

  useEffect(() => {
    const nextSettings = toLegacyProLayoutSettings();
    setInitialState((state) => {
      if (hasSameLegacyLayoutSettings(state?.settings, nextSettings)) {
        return state;
      }
      return {
        ...state,
        settings: {
          ...state?.settings,
          ...nextSettings,
        },
      };
    });
  }, [
    dark,
    device,
    fixedHeader,
    setInitialState,
    sideTheme,
    sidebarHide,
    sidebarLogo,
    sidebarOpened,
    themeColor,
    title,
    topNav,
  ]);

  useEffect(() => {
    document.title = getLegacyPageTitle(initialState, currentPath);
  }, [
    currentPath,
    currentRoute?.meta?.title,
    dynamicTitle,
    initialState,
    title,
  ]);

  useEffect(() => {
    NProgress.start();
    const done = () => NProgress.done();
    const useAnimationFrame =
      typeof window.requestAnimationFrame === 'function';
    const frameId = useAnimationFrame
      ? window.requestAnimationFrame(done)
      : window.setTimeout(done, 0);

    return () => {
      if (
        useAnimationFrame &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(frameId);
      } else {
        window.clearTimeout(frameId);
      }
      NProgress.done();
    };
  }, [location.hash, location.pathname, location.search]);

  return (
    <KeepAliveView
      activePath={currentPath}
      noCache={Boolean(currentRoute?.meta?.noCache)}
    >
      {children}
    </KeepAliveView>
  );
};

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  const legacySettings = useSettingsStore.getState();
  const legacyApp = useAppStore.getState();
  return {
    menuItemRender: (item, dom) => {
      if (item.path) {
        return <Link to={item.path}>{dom}</Link>;
      }
      return dom;
    },
    breadcrumbRender: () => {
      const currentRoute = getRouteByPath(
        initialState?.routeComponentMap,
        history.location.pathname,
      );
      return buildBreadcrumbItems(
        initialState?.permissionState?.sidebarRouters || [],
        history.location.pathname,
        currentRoute,
      );
    },
    breadcrumbProps: {
      minLength: 1,
    },
    collapsed: !legacyApp.sidebarOpened,
    onCollapse: (collapsed) => {
      if (collapsed) {
        useAppStore.getState().closeSideBar();
      } else {
        useAppStore.getState().openSideBar();
      }
    },
    actionsRender: () => {
      if (useAppStore.getState().device === 'mobile') {
        return [];
      }
      // `locale: false` opts out of the language switcher. ProLayout's own
      // `locale` prop is a locale string, so narrow to the boolean toggle here.
      const localeEnabled =
        (initialState?.settings as { locale?: boolean })?.locale !== false;
      return [
        <Suspense key="search" fallback={null}>
          <SearchMenu />
        </Suspense>,
        <Suspense key="notice" fallback={null}>
          <NoticeBell />
        </Suspense>,
        <InfoQGit key="git" />,
        <ScreenFull key="screenfull" />,
        localeEnabled && <LangSelect key="lang" />,
        <SizeSelect key="size" />,
      ].filter(Boolean);
    },
    headerTitleRender: (logo, title) => {
      if (!legacySettings.topNav) {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            {logo}
            {title}
          </span>
        );
      }
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            minWidth: 0,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {logo}
            {title}
          </span>
          <TopNav />
        </div>
      );
    },
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      title: initialState?.currentUser?.name || 'User',
      render: (_, avatarChildren) => (
        <Suspense fallback={avatarChildren}>
          <AvatarDropdown>{avatarChildren}</AvatarDropdown>
        </Suspense>
      ),
    },
    // waterMarkProps: {
    //   content: initialState?.currentUser?.name,
    // },
    footerRender: false,
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
    pageTitleRender: () =>
      getLegacyPageTitle(initialState, history.location.pathname),
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
          <LayoutRuntimeShell
            initialState={initialState}
            setInitialState={
              setInitialState as LayoutRuntimeShellProps['setInitialState']
            }
          >
            {children}
          </LayoutRuntimeShell>
          {initialState?.settingDrawerOpen ? (
            <Suspense fallback={null}>
              <SettingsDrawer
                open
                onClose={() => {
                  setInitialState((s) => ({
                    ...s,
                    settingDrawerOpen: false,
                  }));
                }}
              />
            </Suspense>
          ) : null}
        </>
      );
    },
    ...initialState?.settings,
    ...toLegacyProLayoutSettings(legacySettings, legacyApp),
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

const RuntimeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const size = useAppStore((state) => state.size);
  const language = useAppStore((state) => state.language);
  const dark = useSettingsStore((state) => state.dark);
  const primary = useSettingsStore((state) => state.theme);
  const themeConfig = useMemo(
    () => ({
      token: {
        colorPrimary: primary,
        borderRadius: 8,
        borderRadiusLG: 12,
        fontFamily:
          'Helvetica Neue, Helvetica, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Arial, sans-serif',
        ...(dark ? {} : { colorBgLayout: '#f5f7f9' }),
      },
      algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    }),
    [dark, primary],
  );
  const designToken = useMemo(
    () => antdTheme.getDesignToken(themeConfig),
    [themeConfig],
  );

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.themeMode = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--current-color', primary);
    document.documentElement.style.setProperty(
      '--table-header-bg',
      dark ? designToken.colorBgContainer : '#f8f8f9',
    );
    document.documentElement.style.setProperty(
      '--table-header-text',
      dark ? designToken.colorText : '#515a6e',
    );
    document.documentElement.style.setProperty(
      '--btn-primary-bg',
      dark ? designToken.colorPrimaryBg : designToken.colorPrimary,
    );
    document.documentElement.style.setProperty(
      '--btn-primary-border',
      dark ? designToken.colorPrimaryBorder : designToken.colorPrimary,
    );
    document.documentElement.style.setProperty(
      '--btn-primary-hover-bg',
      dark ? designToken.colorPrimaryBgHover : designToken.colorPrimaryHover,
    );
    document.documentElement.style.setProperty(
      '--btn-primary-hover-border',
      dark
        ? designToken.colorPrimaryBorderHover
        : designToken.colorPrimaryHover,
    );
    document.body.style.backgroundColor = designToken.colorBgLayout;
    document.body.style.color = designToken.colorText;
    document.body.style.fontFamily =
      'Helvetica Neue, Helvetica, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Arial, sans-serif';
  }, [
    dark,
    designToken.colorBgContainer,
    designToken.colorBgLayout,
    designToken.colorPrimary,
    designToken.colorPrimaryBg,
    designToken.colorPrimaryBgHover,
    designToken.colorPrimaryBorder,
    designToken.colorPrimaryBorderHover,
    designToken.colorPrimaryHover,
    designToken.colorText,
    primary,
  ]);

  return (
    <ConfigProvider
      componentSize={size}
      locale={language === 'en_US' ? enUS : zhCN}
      theme={themeConfig}
      form={{ colon: false }}
    >
      {children}
    </ConfigProvider>
  );
};

export function rootContainer(container: React.ReactNode) {
  return (
    <RuntimeProvider>
      <AntdApp>
        <AntdAppBridge />
        <OfflineBanner />
        <ErrorBoundary>{container}</ErrorBoundary>
      </AntdApp>
    </RuntimeProvider>
  );
}
