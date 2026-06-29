import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useAppStore} from '@/store/modules/app';
import {useSettingsStore} from '@/store/modules/settings';

vi.mock('@umijs/max', () => ({
  history: {
    location: {
      pathname: '/index',
      search: '',
      hash: '',
    },
    replace: vi.fn(),
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  useLocation: () => ({
    pathname: '/index',
    search: '',
    hash: '',
  }),
}));

vi.mock('@/components', () => ({
  AvatarDropdown: ({ children }: { children: React.ReactNode }) => children,
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  LayoutTagsView: () => <div data-testid="layout-tags-view" />,
  OfflineBanner: () => null,
}));

vi.mock('@/components/SvgIcon', () => ({
  default: ({ iconClass }: { iconClass: string }) => (
    <span data-icon-class={iconClass} />
  ),
}));

vi.mock('@ant-design/pro-components', () => ({
  SettingDrawer: () => <div data-testid="setting-drawer" />,
}));

vi.mock('@/components/SettingsDrawer', () => ({
  default: () => <div data-testid="setting-drawer" />,
}));

vi.mock('@/components/KeepAliveView', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="keep-alive-view">{children}</div>
  ),
}));

vi.mock('@/components/TopNav', () => ({
  default: () => <div data-testid="top-nav" />,
}));

vi.mock('nprogress', () => ({
  default: {
    configure: vi.fn(),
    done: vi.fn(),
    start: vi.fn(),
  },
}));

vi.mock('@/services/ant-design-pro/api', () => ({
  getInfo: vi.fn(),
  getRouters: vi.fn(),
}));

vi.mock('@/requestErrorConfig', () => ({
  errorConfig: {},
}));

vi.mock('@root/config/defaultSettings', () => ({
  default: { navTheme: 'light' },
}));

const { layout } = await import('@/app');

describe('ProLayout runtime config', () => {
  beforeEach(() => {
    useAppStore.setState({ device: 'desktop' });
    useSettingsStore.setState({ topNav: false });
  });

  it('renders backend menu icon names as SvgIcon nodes', () => {
    const layoutConfig = layout({
      initialState: {
        settings: {},
      },
      setInitialState: vi.fn(),
    } as any);

    const menuData = layoutConfig.menuDataRender?.([
      {
        path: '/monitor',
        name: '系统监控',
        icon: 'monitor',
        children: [
          {
            path: '/monitor/cache',
            name: '缓存监控',
            icon: 'redis',
          },
        ],
      },
    ] as any);

    expect(menuData?.[0]?.icon).toMatchObject({
      props: {
        iconClass: 'monitor',
      },
    });
    expect(menuData?.[0]?.children?.[0]?.icon).toMatchObject({
      props: {
        iconClass: 'redis',
      },
    });
  });

  it('renders tags-view and SettingDrawer through childrenRender', () => {
    const layoutConfig = layout({
      initialState: {
        settings: {},
        settingDrawerOpen: false,
      },
      setInitialState: vi.fn(),
    } as any);

    render(layoutConfig.childrenRender?.(<div>Page Content</div>, {} as any));

    expect(screen.getByTestId('layout-tags-view')).toBeInTheDocument();
    expect(screen.getByTestId('setting-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('keep-alive-view')).toBeInTheDocument();
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('renders TopNav in the header title when legacy topNav is enabled', () => {
    useSettingsStore.setState({ topNav: true });
    const layoutConfig = layout({
      initialState: {
        settings: {},
        settingDrawerOpen: false,
      },
      setInitialState: vi.fn(),
    } as any);
    const headerTitleRender = layoutConfig.headerTitleRender;
    expect(typeof headerTitleRender).toBe('function');

    render(
      typeof headerTitleRender === 'function'
        ? headerTitleRender(<span>Logo</span>, <b>Title</b>, {} as any)
        : null,
    );

    expect(screen.getByTestId('top-nav')).toBeInTheDocument();
  });

  it('hides header action icons on mobile like the legacy React layout', () => {
    useAppStore.setState({ device: 'mobile' });
    const layoutConfig = layout({
      initialState: {
        settings: {},
        settingDrawerOpen: false,
      },
      setInitialState: vi.fn(),
    } as any);

    const actionsRender = layoutConfig.actionsRender;

    expect(typeof actionsRender).toBe('function');
    if (typeof actionsRender === 'function') {
      expect(actionsRender({} as any)).toEqual([]);
    }
  });
});
