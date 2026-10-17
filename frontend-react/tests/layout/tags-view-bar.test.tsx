import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TagsViewBar from '@/layouts/TagsViewBar';
import { useSettingsStore } from '@/store/modules/settings';
import { useTagsViewStore } from '@/store/modules/tagsView';

describe('layouts/tags-view-bar', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      tagsIcon: false
    });
    useTagsViewStore.setState({
      visitedViews: [
        { fullPath: '/index', name: 'index', path: '/index', title: '首页', affix: true },
        { fullPath: '/system/user', name: 'user', path: '/system/user', title: '用户管理' },
        { fullPath: '/system/role', name: 'role', path: '/system/role', title: '角色管理' },
        { fullPath: '/monitor/cache', name: 'cache', path: '/monitor/cache', title: '缓存监控' }
      ],
      cachedViews: ['index', 'user', 'role', 'cache']
    });
  });

  it('shows context menu options on right click and supports close left', () => {
    render(
      <MemoryRouter>
        <TagsViewBar activePath="/system/role" />
      </MemoryRouter>
    );

    fireEvent.contextMenu(screen.getByText('角色管理'));

    expect(screen.getByText('刷新页面')).toBeInTheDocument();
    expect(screen.getByText('关闭当前')).toBeInTheDocument();
    expect(screen.getByText('关闭其他')).toBeInTheDocument();
    expect(screen.getByText('关闭左侧')).toBeInTheDocument();
    expect(screen.getByText('关闭右侧')).toBeInTheDocument();
    expect(screen.getByText('全部关闭')).toBeInTheDocument();

    fireEvent.click(screen.getByText('关闭左侧'));

    expect(useTagsViewStore.getState().visitedViews.map((item) => item.path)).toEqual(['/index', '/system/role', '/monitor/cache']);
  });

  it('supports close-right action from context menu', () => {
    render(
      <MemoryRouter>
        <TagsViewBar activePath="/system/user" />
      </MemoryRouter>
    );

    fireEvent.contextMenu(screen.getByText('用户管理'));
    fireEvent.click(screen.getByText('关闭右侧'));

    expect(useTagsViewStore.getState().visitedViews.map((item) => item.path)).toEqual(['/index', '/system/user']);
  });

  it('hides close-current menu item for affix tab', () => {
    render(
      <MemoryRouter>
        <TagsViewBar activePath="/index" />
      </MemoryRouter>
    );

    fireEvent.contextMenu(screen.getByText('首页'));
    expect(screen.queryByText('关闭当前')).toBeNull();
  });
});
