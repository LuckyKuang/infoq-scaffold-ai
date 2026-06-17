import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
}));

vi.mock('@/components', () => ({
  AvatarDropdown: ({ children }: { children: React.ReactNode }) => children,
  DocLink: () => null,
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  Footer: () => null,
  LangDropdown: () => null,
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
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });
});
