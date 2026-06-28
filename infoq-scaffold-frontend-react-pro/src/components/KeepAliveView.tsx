import type {ReactNode} from 'react';
import {useEffect, useRef} from 'react';
import {useTagsViewStore} from '@/store/modules/tagsView';

type KeepAliveViewProps = {
  activePath: string;
  noCache?: boolean;
  children: ReactNode;
};

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

  cacheRef.current[activePath] = children;

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
