import {Navigate, useLocation, useModel} from '@umijs/max';
import {Spin} from 'antd';
import {Suspense} from 'react';
import InnerLink from '@/components/InnerLink';
import {resolvePageComponent} from '@/router/component-map';
import {convertPathToComponent} from '@/router/path-to-component';
import {findFirstConcreteChildPath, resolveRoutePath,} from '@/router/route-transform';

const normalizePath = (path: string) =>
  path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

export default function BackendRouteView() {
  const location = useLocation();
  const { initialState } = useModel('@@initialState');
  const routeComponentMap = initialState?.routeComponentMap || {};
  const currentPath = normalizePath(location.pathname);
  const routeDef =
    routeComponentMap[currentPath] ||
    routeComponentMap[resolveRoutePath(currentPath)] ||
    routeComponentMap[`${currentPath}/index`];
  const componentName =
    routeDef?.component || convertPathToComponent(currentPath);

  if (componentName === 'Layout' || componentName === 'ParentView') {
    return (
      <Navigate
        to={
          findFirstConcreteChildPath(routeComponentMap, currentPath) || '/404'
        }
        replace
      />
    );
  }

  if (componentName === 'InnerLink') {
    const link =
      routeDef.meta?.link ||
      decodeURIComponent(currentPath.replace('/inner-link/', ''));
    return <InnerLink src={link} iframeId={`inner-link-${currentPath}`} />;
  }

  const DynamicPage = resolvePageComponent(componentName);

  return (
    <Suspense fallback={<Spin />}>
      <DynamicPage />
    </Suspense>
  );
}
