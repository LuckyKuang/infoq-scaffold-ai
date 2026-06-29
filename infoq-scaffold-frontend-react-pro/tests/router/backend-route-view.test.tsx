import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import BackendRouteView from '@/pages/BackendRouteView';

const locationState = vi.hoisted(() => ({
  pathname: '/system/missing',
  search: '',
}));

const modelState = vi.hoisted(() => ({
  initialState: {
    routeComponentMap: {},
  },
}));

vi.mock('@umijs/max', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  useLocation: () => locationState,
  useModel: () => modelState,
}));

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));

describe('pages/BackendRouteView', () => {
  beforeEach(() => {
    locationState.pathname = '/system/missing';
    locationState.search = '';
    modelState.initialState.routeComponentMap = {};
  });

  it('falls back to the legacy 404 page for unmapped backend components', async () => {
    render(<BackendRouteView />);

    expect(await screen.findByText('404错误!')).toBeInTheDocument();
    expect(screen.getByText('找不到网页！')).toBeInTheDocument();
  });

  it('redirects ParentView menu groups to the first concrete child route', () => {
    locationState.pathname = '/system/log';
    modelState.initialState.routeComponentMap = {
      '/system/log': {
        path: '/system/log',
        name: 'Log',
        component: 'ParentView',
        meta: {
          title: '日志管理',
        },
      },
      '/system/log/loginInfo': {
        path: '/system/log/loginInfo',
        name: 'LoginInfo',
        component: 'monitor/loginInfo/index',
        meta: {
          title: '登录日志',
        },
      },
    };

    render(<BackendRouteView />);

    expect(screen.getByTestId('navigate')).toHaveTextContent(
      '/system/log/loginInfo',
    );
  });
});
