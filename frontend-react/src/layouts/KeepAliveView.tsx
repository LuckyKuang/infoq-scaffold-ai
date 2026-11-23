import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import type { Location } from 'react-router-dom';
import { UNSAFE_LocationContext as LocationContext, useLocation, useNavigationType, useOutlet } from 'react-router-dom';
import { useTagsViewStore } from '@/store/modules/tagsView';

type KeepAliveViewProps = {
  activePath: string;
  noCache?: boolean;
};

type CachedSlot = {
  element: ReactElement;
  location: Location;
};

export default function KeepAliveView({ activePath, noCache }: KeepAliveViewProps) {
  const cacheRef = useRef<Record<string, CachedSlot>>({});
  const visitedViews = useTagsViewStore((state) => state.visitedViews);
  // useOutlet 返回的是当前路由匹配结果；每个路径只在自己处于激活态时刷新对应槽位，其余槽位保持各自最后一次激活时的元素
  const outlet = useOutlet();
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const validPaths = new Set(visitedViews.map((item) => item.path));
    Object.keys(cacheRef.current).forEach((path) => {
      if (!validPaths.has(path)) {
        delete cacheRef.current[path];
      }
    });
  }, [visitedViews]);

  if (noCache) {
    return <>{outlet}</>;
  }

  if (outlet) {
    cacheRef.current[activePath] = { element: outlet, location };
  }

  return (
    <>
      {Object.entries(cacheRef.current).map(([path, slot]) => (
        <div key={path} style={{ display: path === activePath ? 'block' : 'none' }}>
          {/* 隐藏槽位里的页面（如 BackendRouteView）通过 useLocation 解析组件，需固定为其所属路径的 location */}
          <LocationContext.Provider value={{ location: slot.location, navigationType }}>{slot.element}</LocationContext.Provider>
        </div>
      ))}
    </>
  );
}
