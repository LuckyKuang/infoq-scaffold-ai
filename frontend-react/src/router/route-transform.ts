import type { AppRoute } from '@/types/router';
import modal from '@/utils/modal';
import { isHttp } from '@/utils/validate';

export type RouteComponentMapItem = {
  name?: string;
  component?: string;
  path: string;
  query?: string;
  meta?: AppRoute['meta'];
};

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
  return `${basePath}/${routePath}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
};

export const filterChildren = (childrenMap: AppRoute[], parentRoute?: AppRoute): AppRoute[] => {
  let children: AppRoute[] = [];
  childrenMap.forEach((route) => {
    const next = { ...route };
    next.path = normalizeRoutePath(next.path, parentRoute?.path || '');
    if (next.children && next.children.length > 0 && next.component === 'ParentView') {
      children = children.concat(filterChildren(next.children, next));
    } else {
      children.push(next);
    }
  });
  return children;
};

const normalizeRoute = (route: AppRoute) => {
  const next = { ...route };

  if (next.component === 'InnerLink') {
    const link = next.meta?.link || next.path;
    if (isHttp(link)) {
      next.meta = {
        ...next.meta,
        link
      };
    }
  }

  if (isHttp(next.path)) {
    next.meta = {
      ...next.meta,
      link: next.path
    };
    next.path = `/inner-link/${encodeURIComponent(next.path)}`;
    next.component = 'InnerLink';
  }

  return next;
};

export const filterAsyncRouter = (routes: AppRoute[], rewrite = false): AppRoute[] => {
  return routes
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
};

export const withAbsoluteRoutePaths = (routes: AppRoute[], parentPath = ''): AppRoute[] => {
  return routes.map((route) => {
    const next = {
      ...route,
      path: resolveRoutePath(route.path, parentPath)
    };

    if (route.children && route.children.length > 0) {
      next.children = withAbsoluteRoutePaths(route.children, next.path);
    }

    return next;
  });
};

const flattenRoutes = (routes: AppRoute[]) => {
  const list: AppRoute[] = [];
  routes.forEach((route) => {
    list.push(route);
    if (route.children && route.children.length > 0) {
      list.push(...flattenRoutes(route.children));
    }
  });
  return list;
};

export const assertNoRouteConflicts = (routes: AppRoute[]) => {
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

    const key = route.path;
    if (pathSet.has(key)) {
      conflicts.push(`重复路由路径: ${key}`);
    } else {
      pathSet.add(key);
    }
  });

  if (conflicts.length > 0) {
    modal.notifyError({
      title: '路由冲突',
      description: conflicts.join('；')
    });
    throw new Error(conflicts.join('; '));
  }
};

export const buildRouteComponentMap = (routes: AppRoute[]) => {
  const map: Record<string, RouteComponentMapItem> = {};

  const walk = (items: AppRoute[], parentPath = '') => {
    items.forEach((item) => {
      const path = resolveRoutePath(item.path, parentPath);
      map[path] = {
        name: item.name,
        component: item.component,
        path,
        query: item.query,
        meta: item.meta
      };
      if (item.children && item.children.length > 0) {
        walk(item.children, path);
      }
    });
  };

  walk(routes);
  return map;
};
