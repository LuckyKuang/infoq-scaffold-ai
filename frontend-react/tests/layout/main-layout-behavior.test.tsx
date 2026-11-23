import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useAppStore } from '@/store/modules/app';
import { useNoticeStore } from '@/store/modules/notice';
import { usePermissionStore } from '@/store/modules/permission';
import { useSettingsStore } from '@/store/modules/settings';
import { useTagsViewStore } from '@/store/modules/tagsView';
import type { AppRoute } from '@/types/router';

const systemRoute: AppRoute = {
  path: '/system',
  name: 'System',
  meta: { title: '系统管理' },
  children: [
    { path: '/system/user', name: 'User', component: 'system/user/index', meta: { title: '用户管理' } },
    { path: '/system/role', name: 'Role', component: 'system/role/index', meta: { title: '角色管理' } }
  ]
};
const monitorRoute: AppRoute = {
  path: '/monitor',
  name: 'Monitor',
  meta: { title: '系统监控' },
  children: [{ path: '/monitor/cache', name: 'Cache', component: 'monitor/cache/index', meta: { title: '缓存监控' } }]
};
const homeRoute: AppRoute = { path: '/index', name: 'index', component: 'index', meta: { title: '首页', affix: true } };

const setWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
};

const renderLayout = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route path="*" element={<div>page-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('layouts/main-layout behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    setWidth(1280);
    useAppStore.setState({ sidebarOpened: true, sidebarHide: false, device: 'desktop' });
    useSettingsStore.setState({ title: 'InfoQ', topNav: false, tagsView: false, dark: false });
    useTagsViewStore.setState({ visitedViews: [], cachedViews: [] });
    useNoticeStore.setState({ notices: [], unreadCount: 0, loading: false, refresh: vi.fn().mockResolvedValue(undefined) });
    const routes = [homeRoute, systemRoute, monitorRoute];
    usePermissionStore.setState({
      routes,
      defaultRoutes: routes,
      topbarRouters: routes,
      sidebarRouters: routes,
      routeComponentMap: {},
      getRouteByPath: () => undefined
    });
  });

  it('keeps the sidebar collapsed on desktop after the hamburger toggle', () => {
    const { container } = renderLayout('/index');
    const toggle = container.querySelector('.hamburger-container') as HTMLElement;

    fireEvent.click(toggle);

    expect(useAppStore.getState().sidebarOpened).toBe(false);
    expect(container.querySelector('.layout-shell')).toHaveClass('hideSidebar');

    fireEvent.click(toggle);
    expect(useAppStore.getState().sidebarOpened).toBe(true);
  });

  it('closes the sidebar on mobile resize and reopens it only when returning to desktop', () => {
    renderLayout('/index');

    act(() => {
      setWidth(500);
      window.dispatchEvent(new Event('resize'));
    });
    expect(useAppStore.getState()).toMatchObject({ device: 'mobile', sidebarOpened: false });

    act(() => {
      setWidth(1280);
      window.dispatchEvent(new Event('resize'));
    });
    expect(useAppStore.getState()).toMatchObject({ device: 'desktop', sidebarOpened: true });
  });

  it('shows the selected top menu children in the sidebar in TopNav mode', async () => {
    useSettingsStore.setState({ topNav: true });
    const { container } = renderLayout('/system/user');

    await waitFor(() => {
      expect(container.querySelector('.layout-sider')).not.toBeNull();
    });
    const sidebar = container.querySelector('.sidebar-menu') as HTMLElement;
    expect(within(sidebar).getByText('用户管理')).toBeInTheDocument();
    expect(within(sidebar).getByText('角色管理')).toBeInTheDocument();
    expect(within(sidebar).queryByText('缓存监控')).not.toBeInTheDocument();
  });

  it('switches sidebar children when a top menu with children is selected and hides the sidebar on single-level pages', async () => {
    useSettingsStore.setState({ topNav: true });
    const { container } = renderLayout('/system/user');
    await waitFor(() => expect(container.querySelector('.sidebar-menu')).not.toBeNull());

    const topMenu = container.querySelector('.layout-header-left .ant-menu-horizontal') as HTMLElement;
    fireEvent.click(within(topMenu).getByText('系统监控'));

    await waitFor(() => {
      expect(within(container.querySelector('.sidebar-menu') as HTMLElement).getByText('缓存监控')).toBeInTheDocument();
    });

    fireEvent.click(within(topMenu).getByText('首页'));
    await waitFor(() => {
      expect(container.querySelector('.layout-sider')).toBeNull();
    });
    expect(screen.queryByText('用户管理')).not.toBeInTheDocument();
  });

  it('restores the full sidebar when TopNav mode is turned off', async () => {
    useSettingsStore.setState({ topNav: true });
    const { container } = renderLayout('/system/user');
    await waitFor(() => expect(usePermissionStore.getState().sidebarRouters.map((item) => item.path)).toEqual(['/system/user', '/system/role']));

    act(() => {
      useSettingsStore.setState({ topNav: false });
    });

    await waitFor(() => {
      expect(usePermissionStore.getState().sidebarRouters.map((item) => item.path)).toEqual(expect.arrayContaining(['/index', '/system', '/monitor']));
    });
    expect(useAppStore.getState().sidebarHide).toBe(false);
    expect(container.querySelector('.layout-sider')).not.toBeNull();
  });
});
