import {act, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import KeepAliveView from '@/components/KeepAliveView';
import LayoutTagsView from '@/components/LayoutTagsView';
import {useSettingsStore} from '@/store/modules/settings';
import {useTagsViewStore} from '@/store/modules/tagsView';

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
    expect(useTagsViewStore.getState().visitedViews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fullPath: '/index',
          path: '/index',
          title: '首页',
          affix: true,
        }),
        expect.objectContaining({
          fullPath: '/system/user?page=1',
          path: '/system/user',
          title: '用户管理',
          icon: 'user',
        }),
      ]),
    );
  });

  it('does not render the tag bar when tagsView is disabled', () => {
    useSettingsStore.setState({
      tagsView: false,
    });

    render(<LayoutTagsView />);

    expect(screen.queryByTestId('tags-view-bar')).toBeNull();
  });
});

describe('layout/KeepAliveView', () => {
  beforeEach(() => {
    useTagsViewStore.setState({
      visitedViews: [
        {
          fullPath: '/system/user',
          name: 'User',
          path: '/system/user',
          title: '用户管理',
        },
        {
          fullPath: '/system/role',
          name: 'Role',
          path: '/system/role',
          title: '角色管理',
        },
      ],
      cachedViews: [],
    });
  });

  it('keeps previous route nodes mounted when switching active path', () => {
    const { rerender } = render(
      <KeepAliveView activePath="/system/user">
        <div>User Page</div>
      </KeepAliveView>,
    );

    rerender(
      <KeepAliveView activePath="/system/role">
        <div>Role Page</div>
      </KeepAliveView>,
    );

    expect(screen.getByText('User Page')).toBeInTheDocument();
    expect(screen.getByText('Role Page')).toBeInTheDocument();
    expect(
      screen.getByText('User Page').closest('[data-keep-alive-path]'),
    ).toHaveStyle({ display: 'none' });
  });

  it('keeps the active route mounted before tags store records it', () => {
    useTagsViewStore.setState({
      visitedViews: [
        {
          fullPath: '/system/role',
          name: 'Role',
          path: '/system/role',
          title: '角色管理',
        },
      ],
      cachedViews: [],
    });

    const { rerender } = render(
      <KeepAliveView activePath="/system/user">
        <div>User Page</div>
      </KeepAliveView>,
    );

    rerender(
      <KeepAliveView activePath="/system/role">
        <div>Role Page</div>
      </KeepAliveView>,
    );

    expect(screen.getByText('User Page')).toBeInTheDocument();
    expect(
      screen.getByText('User Page').closest('[data-keep-alive-path]'),
    ).toHaveStyle({ display: 'none' });
    expect(screen.getByText('Role Page')).toBeInTheDocument();
  });

  it('does not cache routes marked as noCache', () => {
    const { rerender } = render(
      <KeepAliveView activePath="/system/user" noCache>
        <div>User Page</div>
      </KeepAliveView>,
    );

    rerender(
      <KeepAliveView activePath="/system/role" noCache>
        <div>Role Page</div>
      </KeepAliveView>,
    );

    expect(screen.queryByText('User Page')).toBeNull();
    expect(screen.getByText('Role Page')).toBeInTheDocument();
  });

  it('removes cached route nodes when their tags are closed', () => {
    const { rerender } = render(
      <KeepAliveView activePath="/system/user">
        <div>User Page</div>
      </KeepAliveView>,
    );

    rerender(
      <KeepAliveView activePath="/system/role">
        <div>Role Page</div>
      </KeepAliveView>,
    );

    act(() => {
      useTagsViewStore.setState({
        visitedViews: [
          {
            fullPath: '/system/role',
            name: 'Role',
            path: '/system/role',
            title: '角色管理',
          },
        ],
      });
    });

    rerender(
      <KeepAliveView activePath="/system/role">
        <div>Role Page</div>
      </KeepAliveView>,
    );

    expect(screen.queryByText('User Page')).toBeNull();
    expect(screen.getByText('Role Page')).toBeInTheDocument();
  });

  it('evicts the oldest inactive route when cached routes exceed the limit', () => {
    useTagsViewStore.setState({
      visitedViews: Array.from({ length: 9 }, (_, index) => ({
        fullPath: `/system/page-${index + 1}`,
        name: `Page${index + 1}`,
        path: `/system/page-${index + 1}`,
        title: `页面${index + 1}`,
      })),
      cachedViews: [],
    });

    const { rerender, container } = render(
      <KeepAliveView activePath="/system/page-1">
        <div>Page 1</div>
      </KeepAliveView>,
    );

    for (let index = 2; index <= 9; index += 1) {
      rerender(
        <KeepAliveView activePath={`/system/page-${index}`}>
          <div>{`Page ${index}`}</div>
        </KeepAliveView>,
      );
    }

    expect(screen.queryByText('Page 1')).toBeNull();
    expect(screen.getByText('Page 9')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-keep-alive-path]')).toHaveLength(
      8,
    );
  });
});
