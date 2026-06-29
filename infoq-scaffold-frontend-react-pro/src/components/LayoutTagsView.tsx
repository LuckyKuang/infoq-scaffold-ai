import {useLocation, useModel} from '@umijs/max';
import {useEffect, useMemo} from 'react';
import TagsViewBar from '@/components/TagsViewBar';
import type {RouteComponentMapItem} from '@/router/route-transform';
import {resolveRoutePath} from '@/router/route-transform';
import {useSettingsStore} from '@/store/modules/settings';
import type {TagView} from '@/store/modules/tagsView';
import {useTagsViewStore} from '@/store/modules/tagsView';

const normalizePath = (path: string) =>
  path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

const staticRouteMap: Record<string, RouteComponentMapItem> = {
  '/index': {
    path: '/index',
    name: 'index',
    component: 'index',
    meta: {
      title: '首页',
      icon: 'dashboard',
      affix: true,
    },
  },
  '/user/profile': {
    path: '/user/profile',
    name: 'Profile',
    component: 'system/user/profile/index',
    meta: {
      title: '个人中心',
      icon: 'user',
    },
  },
};

const toTagView = (
  routeDef: RouteComponentMapItem | undefined,
  path: string,
  search: string,
): TagView | undefined => {
  if (!routeDef) {
    return undefined;
  }
  const title = routeDef.meta?.title || routeDef.name || path;
  return {
    fullPath: `${path}${search}`,
    name: routeDef.name || routeDef.component || path,
    path,
    title,
    icon: routeDef.meta?.icon,
    noCache: routeDef.meta?.noCache,
    affix: routeDef.meta?.affix || path === '/index',
  };
};

export default function LayoutTagsView() {
  const location = useLocation();
  const { initialState } = useModel('@@initialState');
  const tagsView = useSettingsStore((state) => state.tagsView);
  const addView = useTagsViewStore((state) => state.addView);
  const currentPath = normalizePath(location.pathname);

  const affixTags = useMemo(() => {
    const routeComponentMap = initialState?.routeComponentMap || {};
    return Object.values({
      ...staticRouteMap,
      ...routeComponentMap,
    })
      .filter((routeDef) => routeDef.meta?.affix)
      .map((routeDef) => toTagView(routeDef, normalizePath(routeDef.path), ''))
      .filter((tag): tag is TagView => Boolean(tag));
  }, [initialState?.routeComponentMap]);

  const currentTag = useMemo(() => {
    const routeComponentMap = initialState?.routeComponentMap || {};
    const routeDef =
      routeComponentMap[currentPath] ||
      routeComponentMap[resolveRoutePath(currentPath)] ||
      routeComponentMap[`${currentPath}/index`] ||
      staticRouteMap[currentPath];
    return toTagView(routeDef, currentPath, location.search);
  }, [currentPath, initialState?.routeComponentMap, location.search]);

  useEffect(() => {
    affixTags.forEach((tag) => {
      addView(tag);
    });
    if (currentTag) {
      addView(currentTag);
    }
  }, [addView, affixTags, currentTag]);

  if (!tagsView) {
    return null;
  }

  return <TagsViewBar activePath={currentPath} />;
}
