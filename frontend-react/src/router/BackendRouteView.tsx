import { Suspense, useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import InnerLink from '@/components/InnerLink';
import { resolvePageComponent } from '@/router/component-map';
import { convertPathToComponent } from '@/router/path-to-component';
import { usePermissionStore } from '@/store/modules/permission';
import { useTagsViewStore } from '@/store/modules/tagsView';

export default function BackendRouteView() {
  const location = useLocation();
  const routeComponentMap = usePermissionStore((state) => state.routeComponentMap);
  const getRouteByPath = usePermissionStore((state) => state.getRouteByPath);
  const getRouteByComponent = usePermissionStore((state) => state.getRouteByComponent);
  const addView = useTagsViewStore((state) => state.addView);
  const routeByPath = useMemo(
    () => routeComponentMap[location.pathname] || getRouteByPath(location.pathname),
    [getRouteByPath, location.pathname, routeComponentMap]
  );
  const componentName = routeByPath?.component || convertPathToComponent(location.pathname);
  const routeDef = useMemo(
    () => routeByPath || getRouteByComponent(componentName),
    [componentName, getRouteByComponent, routeByPath]
  );

  useEffect(() => {
    const title = routeDef?.meta?.title || (routeDef?.name ? String(routeDef.name) : '');
    if (!title) {
      return;
    }
    addView({
      fullPath: location.pathname + location.search,
      name: routeDef?.name || componentName,
      path: location.pathname,
      title,
      icon: routeDef?.meta?.icon,
      noCache: routeDef?.meta?.noCache,
      affix: routeDef?.meta?.affix
    });
  }, [addView, componentName, location.pathname, location.search, routeDef?.meta?.affix, routeDef?.meta?.icon, routeDef?.meta?.noCache, routeDef?.meta?.title, routeDef?.name]);

  if (componentName === 'Layout') {
    return <Navigate to="/index" replace />;
  }

  if (componentName === 'ParentView') {
    return <Navigate to="/404" replace />;
  }

  if (componentName === 'InnerLink') {
    const link = routeDef?.meta?.link || decodeURIComponent(location.pathname.replace('/inner-link/', ''));
    return <InnerLink src={link} iframeId={`inner-link-${location.pathname}`} />;
  }

  const DynamicPage = resolvePageComponent(componentName);

  return (
    <Suspense fallback={<Spin />}>
      <DynamicPage />
    </Suspense>
  );
}
