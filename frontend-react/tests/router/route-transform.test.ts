import { describe, expect, it, vi } from 'vitest';
import { notification } from 'antd';
import type { AppRoute } from '@/types/router';
import { assertNoRouteConflicts, buildRouteComponentMap, filterAsyncRouter } from '@/router/route-transform';

describe('router/route-transform', () => {
  it('maps ParentView children when rewrite mode is enabled', () => {
    const routes: AppRoute[] = [
      {
        path: '/system',
        component: 'Layout',
        children: [
          {
            path: 'user',
            component: 'ParentView',
            children: [
              {
                path: 'index',
                component: 'system/user/index'
              }
            ]
          }
        ]
      }
    ];

    const output = filterAsyncRouter(routes, true);
    expect(output[0].children?.[0].path).toBe('user/index');
  });

  it('converts http path to InnerLink route', () => {
    const routes: AppRoute[] = [
      {
        path: 'https://infoq.cn',
        component: 'InnerLink',
        meta: {
          title: '外链'
        }
      }
    ];

    const output = filterAsyncRouter(routes);
    expect(output[0].component).toBe('InnerLink');
    expect(output[0].path.startsWith('/inner-link/')).toBe(true);
    expect(output[0].meta?.link).toBe('https://infoq.cn');
  });

  it('throws on duplicate route names or paths', () => {
    vi.spyOn(notification, 'error').mockImplementation(() => {
      return {
        then: undefined
      } as never;
    });

    const routes: AppRoute[] = [
      { path: '/a', name: 'A' },
      { path: '/a', name: 'A-2' }
    ];

    expect(() => assertNoRouteConflicts(routes)).toThrow();
  });

  it('builds path to component map', () => {
    const routes: AppRoute[] = [
      {
        path: '/system/user',
        component: 'system/user/index',
        meta: {
          title: '用户管理'
        }
      }
    ];

    const map = buildRouteComponentMap(routes);
    expect(map['/system/user'].component).toBe('system/user/index');
    expect(map['/system/user'].meta?.title).toBe('用户管理');
  });
});
