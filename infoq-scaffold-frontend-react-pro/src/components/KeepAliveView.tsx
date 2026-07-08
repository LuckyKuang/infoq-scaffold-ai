import type {ReactNode} from 'react';
import {useEffect, useRef} from 'react';
import {useTagsViewStore} from '@/store/modules/tagsView';

type KeepAliveViewProps = {
  activePath: string;
  noCache?: boolean;
  children: ReactNode;
};

const MAX_KEEP_ALIVE_ROUTES = 8;

export default function KeepAliveView({
  activePath,
  noCache,
  children,
}: KeepAliveViewProps) {
  const cacheRef = useRef<Record<string, ReactNode>>({});
  const visitedViews = useTagsViewStore((state) => state.visitedViews);

  useEffect(() => {
    const validPaths = new Set(visitedViews.map((item) => item.path));
    validPaths.add(activePath);
    Object.keys(cacheRef.current).forEach((path) => {
      if (!validPaths.has(path)) {
        delete cacheRef.current[path];
      }
    });
  }, [activePath, visitedViews]);

  if (noCache) {
    return <>{children}</>;
  }

  if (Object.hasOwn(cacheRef.current, activePath)) {
    delete cacheRef.current[activePath];
  }
  cacheRef.current[activePath] = children;

  const cachedPaths = Object.keys(cacheRef.current);
  if (cachedPaths.length > MAX_KEEP_ALIVE_ROUTES) {
    for (const path of cachedPaths) {
      if (path === activePath) {
        continue;
      }
      delete cacheRef.current[path];
      if (Object.keys(cacheRef.current).length <= MAX_KEEP_ALIVE_ROUTES) {
        break;
      }
    }
  }

  return (
    <>
      {Object.entries(cacheRef.current).map(([path, node]) => (
        <div
          key={path}
          data-keep-alive-path={path}
          style={{ display: path === activePath ? 'block' : 'none' }}
        >
          {node}
        </div>
      ))}
    </>
  );
}
