import { isHttp } from '@/utils/validate';

export type RouteComponentMapItem = {
  name?: string;
  component?: string;
  path: string;
  query?: string;
  meta?: API.AppRoute['meta'];
};

export type ProMenuRoute = {
  path: string;
  name?: string;
  locale?: false;
  icon?: string;
  hideInMenu?: boolean;
  redirect?: string;
  routes?: ProMenuRoute[];
  children?: ProMenuRoute[];
};

const HOME_ROUTE: API.AppRoute = {
  path: '/index',
  name: 'index',
  component: 'index',
  meta: {
    title: '首页',
    icon: 'dashboard',
    affix: true,
  },
};

const PROFILE_ROUTE: API.AppRoute = {
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
        icon: 'user',
      },
    },
  ],
};

const cloneRoute = <T>(route: T): T => JSON.parse(JSON.stringify(route));

const isHidden = (value: API.AppRoute['hidden']) =>
  value === true || value === 'true' || value === 1 || value === '1';

const normalizeRoutePath = (routePath: string, parentPath = '') => {
  if (!parentPath) {
    return routePath;
  }
  return `${parentPath}/${routePath}`.replace(/\/+/g, '/');
};

export const resolveRoutePath = (routePath: string, parentPath = '') => {
  if (!routePath) {
    return parentPath || '/';
  }
  if (isHttp(routePath)) {
    return routePath;
  }
  if (routePath === '/') {
    return '/';
  }
  if (routePath.startsWith('/')) {
    return routePath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }
  const basePath = parentPath && parentPath !== '/' ? parentPath : '';
  return (
    `${basePath}/${routePath}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  );
};

export const filterChildren = (
  childrenMap: API.AppRoute[],
  parentRoute?: API.AppRoute,
): API.AppRoute[] => {
  let children: API.AppRoute[] = [];
  childrenMap.forEach((route) => {
    const next = { ...route };
    next.path = normalizeRoutePath(next.path, parentRoute?.path || '');
    if (
      next.children &&
      next.children.length > 0 &&
      next.component === 'ParentView'
    ) {
      children = children.concat(filterChildren(next.children, next));
    } else {
      children.push(next);
    }
  });
  return children;
};

const normalizeRoute = (route: API.AppRoute) => {
  const next = { ...route };
  if (next.component === 'InnerLink') {
    const link = next.meta?.link || next.path;
    if (isHttp(link)) {
      next.meta = { ...next.meta, link };
    }
  }
  if (isHttp(next.path)) {
    next.meta = { ...next.meta, link: next.path };
    next.path = `/inner-link/${encodeURIComponent(next.path)}`;
    next.component = 'InnerLink';
  }
  return next;
};

export const filterAsyncRouter = (
  routes: API.AppRoute[],
  rewrite = false,
): API.AppRoute[] =>
  routes
    .filter((route) => !!route.path)
    .map((route) => {
      const next = normalizeRoute(route);
      if (rewrite && next.children) {
        next.children = filterChildren(next.children);
      }
      if (next.children && next.children.length > 0) {
        next.children = filterAsyncRouter(next.children, rewrite);
      }
      return next;
    });

export const withAbsoluteRoutePaths = (
  routes: API.AppRoute[],
  parentPath = '',
): API.AppRoute[] =>
  routes.map((route) => {
    const next = {
      ...route,
      path: resolveRoutePath(route.path, parentPath),
    };
    if (route.children && route.children.length > 0) {
      next.children = withAbsoluteRoutePaths(route.children, next.path);
    }
    return next;
  });

const flattenRoutes = (routes: API.AppRoute[]) => {
  const list: API.AppRoute[] = [];
  routes.forEach((route) => {
    list.push(route);
    if (route.children && route.children.length > 0) {
      list.push(...flattenRoutes(route.children));
    }
  });
  return list;
};

export const assertNoRouteConflicts = (routes: API.AppRoute[]) => {
  const nameSet = new Set<string>();
  const pathSet = new Set<string>();
  const conflicts: string[] = [];

  flattenRoutes(routes).forEach((route) => {
    if (route.name) {
      const name = String(route.name);
      if (nameSet.has(name)) {
        conflicts.push(`重复路由名称: ${name}`);
      } else {
        nameSet.add(name);
      }
    }

    if (pathSet.has(route.path)) {
      conflicts.push(`重复路由路径: ${route.path}`);
    } else {
      pathSet.add(route.path);
    }
  });

  if (conflicts.length > 0) {
    throw new Error(conflicts.join('; '));
  }
};

export const buildRouteComponentMap = (routes: API.AppRoute[]) => {
  const map: Record<string, RouteComponentMapItem> = {};

  const walk = (items: API.AppRoute[], parentPath = '') => {
    items.forEach((item) => {
      const path = resolveRoutePath(item.path, parentPath);
      map[path] = {
        name: item.name,
        component: item.component,
        path,
        query: item.query,
        meta: item.meta,
      };
      if (item.children && item.children.length > 0) {
        walk(item.children, path);
      }
    });
  };

  walk(routes);
  return map;
};

const isConcreteRouteComponent = (component?: string) =>
  !!component && component !== 'Layout' && component !== 'ParentView';

export const findFirstConcreteChildPath = (
  routeComponentMap: Record<string, RouteComponentMapItem>,
  parentPath: string,
) => {
  const normalizedParentPath = resolveRoutePath(parentPath);
  const childPrefix =
    normalizedParentPath === '/' ? '/' : `${normalizedParentPath}/`;
  return Object.values(routeComponentMap).find(
    (route) =>
      route.path !== normalizedParentPath &&
      route.path.startsWith(childPrefix) &&
      isConcreteRouteComponent(route.component),
  )?.path;
};

export const ensureStaticRoutes = (routes: API.AppRoute[]) => {
  const next = [...routes];
  const hasRoutePath = (items: API.AppRoute[], targetPath: string): boolean =>
    items.some(
      (item) =>
        item.path === targetPath ||
        (item.children ? hasRoutePath(item.children, targetPath) : false),
    );

  if (!hasRoutePath(next, HOME_ROUTE.path)) {
    next.unshift(cloneRoute(HOME_ROUTE));
  }
  if (!hasRoutePath(next, '/user/profile')) {
    next.push(cloneRoute(PROFILE_ROUTE));
  }
  return next;
};

export const normalizeSidebarRoutes = (
  routes: API.AppRoute[],
): API.AppRoute[] =>
  routes.flatMap((route) => {
    const next = {
      ...route,
      children: route.children
        ? normalizeSidebarRoutes(route.children)
        : route.children,
    };
    if (next.path === '/' && !next.meta?.title && next.children?.length === 1) {
      return next.children.map((child) => ({ ...child }));
    }
    return [next];
  });

export const toProMenuRoutes = (routes: API.AppRoute[]): ProMenuRoute[] =>
  routes.map((route) => {
    const children = route.children
      ? toProMenuRoutes(route.children)
      : undefined;
    return {
      path: route.path,
      name: route.meta?.title || route.name || route.path,
      locale: false,
      icon:
        route.meta?.icon && route.meta.icon !== '#'
          ? route.meta.icon
          : undefined,
      hideInMenu: isHidden(route.hidden),
      redirect:
        route.redirect && route.redirect !== 'noredirect'
          ? route.redirect
          : undefined,
      routes: children,
      children,
    };
  });
