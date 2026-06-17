import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LayoutTagsView from '@/components/LayoutTagsView';
import { useSettingsStore } from '@/store/modules/settings';
import { useTagsViewStore } from '@/store/modules/tagsView';

const routeState = vi.hoisted(() => ({
  pathname: '/system/user',
  search: '?page=1',
}));

const modelState = vi.hoisted(() => ({
  initialState: {
    routeComponentMap: {
      '/system/user': {
        path: '/system/user',
        name: 'User',
        component: 'system/user/index',
        meta: {
          title: '用户管理',
          icon: 'user',
        },
      },
    },
  },
}));

vi.mock('@umijs/max', () => ({
  useLocation: () => routeState,
  useModel: () => modelState,
}));

vi.mock('@/components/TagsViewBar', () => ({
  default: ({ activePath }: { activePath: string }) => (
    <div data-testid="tags-view-bar">{activePath}</div>
  ),
}));

describe('layout/LayoutTagsView', () => {
  beforeEach(() => {
    routeState.pathname = '/system/user';
    routeState.search = '?page=1';
    useSettingsStore.setState({
      tagsView: true,
    });
    useTagsViewStore.setState({
      visitedViews: [],
      cachedViews: [],
    });
  });

  it('adds current backend route into the tags-view store', () => {
    render(<LayoutTagsView />);

    expect(screen.getByTestId('tags-view-bar')).toHaveTextContent(
      '/system/user',
    );
    expect(useTagsViewStore.getState().visitedViews).toEqual([
      expect.objectContaining({
        fullPath: '/system/user?page=1',
        path: '/system/user',
        title: '用户管理',
        icon: 'user',
      }),
    ]);
  });

  it('does not render the tag bar when tagsView is disabled', () => {
    useSettingsStore.setState({
      tagsView: false,
    });

    render(<LayoutTagsView />);

    expect(screen.queryByTestId('tags-view-bar')).toBeNull();
  });
});
