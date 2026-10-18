import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConfigProvider, theme } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useAppStore } from '@/store/modules/app';
import { useNoticeStore } from '@/store/modules/notice';
import { usePermissionStore } from '@/store/modules/permission';
import { useTagsViewStore } from '@/store/modules/tagsView';
import { useSettingsStore } from '@/store/modules/settings';
import { useUserStore } from '@/store/modules/user';

const refreshMock = vi.fn();

describe('layouts/main-layout-icons', () => {
  let logoutMock = vi.fn<() => Promise<void>>(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useAppStore.setState({
      sidebarOpened: true,
      sidebarHide: false,
      device: 'desktop',
      language: 'zh_CN'
    });
    useSettingsStore.setState({
      title: 'InfoQ',
      topNav: false,
      tagsView: true,
      fixedHeader: false,
      sideTheme: 'theme-dark',
      dark: false
    });
    useTagsViewStore.setState({
      visitedViews: [{ fullPath: '/monitor/cache', name: 'Cache', path: '/monitor/cache', title: '缓存监控' }],
      cachedViews: ['Cache']
    });
    useNoticeStore.setState({
      notices: [
        {
          messageId: 101,
          messageType: '1',
          messageLevel: 'info',
          title: '系统通知',
          content: '消息内容',
          source: 'system_notice',
          createTime: '2026-03-11 09:00:00',
          readTime: null
        }
      ],
      unreadCount: 1,
      loading: false,
      refresh: refreshMock.mockResolvedValue(undefined)
    });
    logoutMock = vi.fn<() => Promise<void>>(async () => undefined);
    useUserStore.setState({
      nickname: '管理员',
      avatar: '',
      logout: logoutMock
    });
    const monitorRoutes = [
      {
        path: '/monitor',
        name: 'Monitor',
        meta: { title: '系统监控', icon: 'monitor' },
        children: [
          {
            path: '/monitor/cache',
            name: 'Cache',
            component: 'monitor/cache/index',
            meta: { title: '缓存监控', icon: 'redis' }
          }
        ]
      }
    ];
    usePermissionStore.setState({
      routes: [
        {
          path: '/index',
          name: 'index',
          component: 'index',
          meta: { title: '首页', affix: true }
        },
        ...monitorRoutes
      ],
      sidebarRouters: [...monitorRoutes],
      getRouteByPath: () => ({
        path: '/monitor/cache',
        component: 'monitor/cache/index',
        meta: { title: '缓存监控', icon: 'redis' }
      })
    });
  });

  it('renders logo and copied svg icons in the layout', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/monitor/cache']}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route path="monitor/cache" element={<div>缓存监控页</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByAltText('logo')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /language|语言/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /message|消息/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'fullscreen' })).toBeInTheDocument();
    expect(within(screen.getByTestId('tags-view-bar')).getByText('首页')).toBeInTheDocument();

    const sidebarMenu = container.querySelector('.sidebar-menu');
    expect(sidebarMenu).not.toBeNull();
    fireEvent.click(within(sidebarMenu as HTMLElement).getByText('系统监控'));
    await waitFor(() => {
      expect(within(sidebarMenu as HTMLElement).getByRole('img', { name: 'redis' })).toBeInTheDocument();
    });
  });

  it('renders breadcrumb titles from route meta instead of raw path segments', async () => {
    usePermissionStore.setState({
      routes: [
        {
          path: '/index',
          name: 'index',
          component: 'index',
          meta: { title: '首页', affix: true }
        },
        {
          path: '/system',
          name: 'System',
          meta: { title: '系统管理', icon: 'system' },
          children: [
            {
              path: '/system/user',
              name: 'User',
              component: 'system/user/index',
              meta: { title: '用户管理', icon: 'user' }
            }
          ]
        }
      ],
      sidebarRouters: [
        {
          path: '/system',
          name: 'System',
          meta: { title: '系统管理', icon: 'system' },
          children: [
            {
              path: '/system/user',
              name: 'User',
              component: 'system/user/index',
              meta: { title: '用户管理', icon: 'user' }
            }
          ]
        }
      ],
      getRouteByPath: () => ({
        path: '/system/user',
        component: 'system/user/index',
        meta: { title: '用户管理', icon: 'user' }
      })
    });

    render(
      <MemoryRouter initialEntries={['/system/user']}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route path="system/user" element={<div>用户管理页</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('main-breadcrumb')).toHaveTextContent('用户管理');
    });
    expect(screen.getByTestId('main-breadcrumb')).toHaveTextContent('首页');
    expect(screen.getByTestId('main-breadcrumb')).toHaveTextContent('系统管理');
    expect(screen.getByTestId('main-breadcrumb')).toHaveTextContent('用户管理');
    expect(screen.getByTestId('main-breadcrumb')).not.toHaveTextContent('/system');
    expect(screen.getByTestId('main-breadcrumb')).not.toHaveTextContent('/system/user');
  });

  it('uses dark sidebar menu theme and dark tag bar background in dark mode', async () => {
    useSettingsStore.setState({
      dark: true,
      sideTheme: 'theme-dark',
      tagsView: true
    });

    const darkToken = theme.getDesignToken({
      algorithm: theme.darkAlgorithm
    });

    const { container } = render(
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm
        }}
      >
        <MemoryRouter initialEntries={['/monitor/cache']}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route path="monitor/cache" element={<div>缓存监控页</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ConfigProvider>
    );

    await waitFor(() => {
      expect(container.querySelector('.ant-menu-dark')).not.toBeNull();
    });
    expect(screen.getByTestId('tags-view-bar')).toHaveStyle({
      background: darkToken.colorBgContainer
    });
  });
});
