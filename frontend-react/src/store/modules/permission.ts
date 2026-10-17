import { create } from 'zustand';
import { getRouters } from '@/api/menu';
import type { AppRoute } from '@/types/router';
import auth from '@/utils/permission';
import {
  assertNoRouteConflicts,
  buildRouteComponentMap,
  filterAsyncRouter,
  type RouteComponentMapItem,
  withAbsoluteRoutePaths
} from '@/router/route-transform';

const HOME_ROUTE: AppRoute = {
  path: '/index',
  name: 'index',
  component: 'index',
  meta: {
    title: '首页',
    icon: 'dashboard',
    affix: true
  }
};

const PROFILE_ROUTE: AppRoute = {
  path: '/user',
  hidden: true,
  redirect: 'noredirect',
  children: [
    {
      path: 'profile',
      name: 'Profile',
      component: 'system/user/profile/index',
      meta: {
        title: '个人中心',
        icon: 'user'
      }
    }
  ]
};

const cloneRoute = <T>(route: T): T => JSON.parse(JSON.stringify(route));

const cloneRouteList = (routes: AppRoute[]) => {
  if (!Array.isArray(routes)) {
    throw new Error('路由响应 data 必须是数组');
  }
  return JSON.parse(JSON.stringify(routes)) as AppRoute[];
};

const hasRoutePath = (routes: AppRoute[], targetPath: string): boolean => {
  return routes.some((route) => route.path === targetPath || (route.children ? hasRoutePath(route.children, targetPath) : false));
};

const withHomeMeta = (routes: AppRoute[]): AppRoute[] => {
  return routes.map((route) => {
    const next: AppRoute = {
      ...route,
      children: route.children ? withHomeMeta(route.children) : route.children
    };

    if (next.path !== HOME_ROUTE.path) {
      return next;
    }

    const title = next.meta?.title || HOME_ROUTE.meta?.title;
    const icon = next.meta?.icon && next.meta.icon !== '#' ? next.meta.icon : HOME_ROUTE.meta?.icon;

    next.meta = {
      ...next.meta,
      title,
      icon,
      affix: next.meta?.affix ?? HOME_ROUTE.meta?.affix
    };

    return next;
  });
};

const ensureStaticRoutes = (routes: AppRoute[]): AppRoute[] => {
  const next = withHomeMeta([...routes]);

  if (!hasRoutePath(next, HOME_ROUTE.path)) {
    next.unshift(cloneRoute(HOME_ROUTE));
  }

  if (!hasRoutePath(next, '/user/profile')) {
    next.push(cloneRoute(PROFILE_ROUTE));
  }

  return next;
};

const normalizeSidebarRoutes = (routes: AppRoute[]): AppRoute[] => {
  return routes.flatMap((route) => {
    const next = {
      ...route,
      children: route.children ? normalizeSidebarRoutes(route.children) : route.children
    };

    if (next.path === '/' && !next.meta?.title && next.children?.length === 1) {
      return next.children.map((child) => ({ ...child }));
    }

    return [next];
  });
};

export const filterDynamicRoutes = (routes: AppRoute[]) => {
  const res: AppRoute[] = [];
  routes.forEach((route) => {
    if (route.permissions) {
      if (auth.hasPermiOr(route.permissions)) {
        res.push(route);
      }
    } else if (route.roles) {
      if (auth.hasRoleOr(route.roles)) {
        res.push(route);
      }
    }
  });
  return res;
};

type PermissionState = {
  routes: AppRoute[];
  addRoutes: AppRoute[];
  defaultRoutes: AppRoute[];
  topbarRouters: AppRoute[];
  sidebarRouters: AppRoute[];
  routeComponentMap: Record<string, RouteComponentMapItem>;
  setRoutes: (newRoutes: AppRoute[]) => void;
  setDefaultRoutes: (routes: AppRoute[]) => void;
  setTopbarRoutes: (routes: AppRoute[]) => void;
  setSidebarRouters: (routes: AppRoute[]) => void;
  generateRoutes: () => Promise<AppRoute[]>;
  getRouteByPath: (path: string) => RouteComponentMapItem | undefined;
  getRouteByComponent: (component?: string) => RouteComponentMapItem | undefined;
};

export const usePermissionStore = create<PermissionState>((set, get) => ({
  routes: [],
  addRoutes: [],
  defaultRoutes: [],
  topbarRouters: [],
  sidebarRouters: [],
  routeComponentMap: {},
  setRoutes: (newRoutes) => set((state) => ({ addRoutes: newRoutes, routes: [...state.defaultRoutes, ...newRoutes] })),
  setDefaultRoutes: (routes) => set({ defaultRoutes: routes }),
  setTopbarRoutes: (routes) => set({ topbarRouters: routes }),
  setSidebarRouters: (routes) => set({ sidebarRouters: routes }),
  generateRoutes: async () => {
    const res = await getRouters();
    const data = cloneRouteList(res.data);
    const sdata: AppRoute[] = JSON.parse(JSON.stringify(data));
    const rdata: AppRoute[] = JSON.parse(JSON.stringify(data));
    const defaultData: AppRoute[] = JSON.parse(JSON.stringify(data));

    const sidebarRoutes = ensureStaticRoutes(normalizeSidebarRoutes(withAbsoluteRoutePaths(filterAsyncRouter(sdata))));
    const rewriteRoutes = withAbsoluteRoutePaths(filterAsyncRouter(rdata, true));
    const defaultRoutes = withAbsoluteRoutePaths(filterAsyncRouter(defaultData));

    assertNoRouteConflicts(rewriteRoutes);

    const routeComponentMap = {
      ...buildRouteComponentMap(ensureStaticRoutes(defaultRoutes)),
      ...buildRouteComponentMap(rewriteRoutes)
    };

    set({
      addRoutes: rewriteRoutes,
      routes: ensureStaticRoutes(rewriteRoutes),
      sidebarRouters: sidebarRoutes,
      defaultRoutes: ensureStaticRoutes(defaultRoutes),
      topbarRouters: defaultRoutes,
      routeComponentMap
    });

    return rewriteRoutes;
  },
  getRouteByPath: (path) => {
    const map = get().routeComponentMap;
    const normalized = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    return map[path] || map[normalized] || map[`${normalized}/index`];
  },
  getRouteByComponent: (component) => {
    if (!component) {
      return undefined;
    }
    const map = get().routeComponentMap;
    const all = Object.values(map);
    return all.find((item) => item.component === component && item.meta?.title) || all.find((item) => item.component === component);
  }
}));
