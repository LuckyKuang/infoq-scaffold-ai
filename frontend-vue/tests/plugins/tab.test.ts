const tabMocks = vi.hoisted(() => {
  return {
    store: {
      delCachedView: vi.fn(),
      delView: vi.fn(),
      delAllViews: vi.fn(),
      delLeftTags: vi.fn(),
      delRightTags: vi.fn(),
      delOthersViews: vi.fn(),
      updateVisitedView: vi.fn()
    },
    router: {
      currentRoute: {
        value: {
          path: '/system/user',
          query: { page: '1' },
          matched: [{ components: { default: { name: 'Layout' } } }, { components: { default: { name: 'SysUser' } } }],
          fullPath: '/system/user?page=1'
        }
      },
      replace: vi.fn(),
      push: vi.fn()
    }
  };
});

vi.mock('@/router', () => ({
  default: tabMocks.router
}));

vi.mock('@/store/modules/tagsView', () => ({
  useTagsViewStore: vi.fn(() => tabMocks.store)
}));

import tab from '@/plugins/tab';
import type { RouteLocationNormalized } from 'vue-router';

describe('plugins/tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabMocks.store.delCachedView.mockResolvedValue(undefined);
    tabMocks.store.delView.mockResolvedValue({ visitedViews: [], cachedViews: [] });
    tabMocks.store.delAllViews.mockResolvedValue('all-closed');
    tabMocks.store.delLeftTags.mockResolvedValue('left-closed');
    tabMocks.store.delRightTags.mockResolvedValue('right-closed');
    tabMocks.store.delOthersViews.mockResolvedValue('others-closed');
    tabMocks.store.updateVisitedView.mockResolvedValue('updated');
    tabMocks.router.replace.mockResolvedValue(undefined);
    tabMocks.router.push.mockResolvedValue(undefined);
  });

  it('refreshes current route when no tab object provided', async () => {
    await tab.refreshPage();

    expect(tabMocks.store.delCachedView).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'SysUser',
        path: '/system/user',
        query: { page: '1' }
      })
    );
    expect(tabMocks.router.replace).toHaveBeenCalledWith({
      path: '/redirect/system/user',
      query: { page: '1' }
    });
  });

  it('handles close page fallback navigation', async () => {
    tabMocks.store.delView.mockResolvedValueOnce({
      visitedViews: [{ fullPath: '/dashboard' }],
      cachedViews: []
    });
    await tab.closePage();
    expect(tabMocks.router.push).toHaveBeenCalledWith('/dashboard');

    tabMocks.store.delView.mockResolvedValueOnce({
      visitedViews: [],
      cachedViews: []
    });
    await tab.closePage();
    expect(tabMocks.router.push).toHaveBeenCalledWith('/');
  });

  it('delegates tab operations to tagsView store and router', async () => {
    const route = { path: '/system/role', fullPath: '/system/role', query: {} } as unknown as RouteLocationNormalized;

    tab.closeOpenPage({ path: '/dashboard' });
    expect(tabMocks.store.delView).toHaveBeenCalledWith(tabMocks.router.currentRoute.value);
    expect(tabMocks.router.push).toHaveBeenCalledWith({ path: '/dashboard' });

    await tab.closePage(route);
    expect(tabMocks.store.delView).toHaveBeenCalledWith(route);

    await tab.closeAllPage();
    expect(tabMocks.store.delAllViews).toHaveBeenCalled();

    await tab.closeLeftPage(route);
    expect(tabMocks.store.delLeftTags).toHaveBeenCalledWith(route);

    await tab.closeRightPage(route);
    expect(tabMocks.store.delRightTags).toHaveBeenCalledWith(route);

    await tab.closeOtherPage(route);
    expect(tabMocks.store.delOthersViews).toHaveBeenCalledWith(route);

    tab.openPage('/system/user', '用户管理', { id: 1 });
    expect(tabMocks.router.push).toHaveBeenCalledWith({
      path: '/system/user',
      query: { id: 1, title: '用户管理' }
    });

    await tab.updatePage(route);
    expect(tabMocks.store.updateVisitedView).toHaveBeenCalledWith(route);
  });
});
