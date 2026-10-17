import { beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BackendRouteView from '@/router/BackendRouteView';
import { usePermissionStore } from '@/store/modules/permission';
import { useTagsViewStore } from '@/store/modules/tagsView';

describe('router/backend-route-view', () => {
  beforeEach(() => {
    useTagsViewStore.setState({
      visitedViews: [],
      cachedViews: []
    });
    usePermissionStore.setState({
      routeComponentMap: {}
    });
  });

  it('adds route tag after route map becomes available on refresh-like render', async () => {
    render(
      <MemoryRouter initialEntries={['/system/menu']}>
        <Routes>
          <Route path="*" element={<BackendRouteView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(useTagsViewStore.getState().visitedViews).toHaveLength(0);

    usePermissionStore.setState({
      routeComponentMap: {
        '/system/menu': {
          path: '/system/menu',
          component: 'system/menu/index',
          name: 'Menu',
          meta: { title: '菜单管理' }
        }
      }
    });

    await waitFor(() => {
      const views = useTagsViewStore.getState().visitedViews;
      expect(views).toHaveLength(1);
      expect(views[0].title).toBe('菜单管理');
      expect(views[0].path).toBe('/system/menu');
    });
  });
});
