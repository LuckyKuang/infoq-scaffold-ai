import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AuthGuard from '@/router/AuthGuard';
import { isWhiteListRoute } from '@/router/public-routes';
import { useUserStore } from '@/store/modules/user';
import * as browserApi from '@/api/browser-session';
import { removeToken } from '@/utils/auth';
import { filterDynamicRoutes, usePermissionStore } from '@/store/modules/permission';
import type { AppRoute } from '@/types/router';

const initialBootstrap = useUserStore.getState().bootstrapSession;
const renderGuard = (base = '/', path = 'system/user') =>
  render(
    <StrictMode>
      <MemoryRouter basename={base} initialEntries={[`${base}${path}`]}>
        <Routes>
          <Route path="/login" element={<LoginLocation />} />
          <Route
            path="*"
            element={
              <AuthGuard>
                <div>Protected</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </StrictMode>
  );
function LoginLocation() {
  const location = useLocation();
  return <div data-testid="login-location">{new URLSearchParams(location.search).get('redirect')}</div>;
}

beforeEach(() => {
  useUserStore.setState(useUserStore.getInitialState());
  useUserStore.getState().invalidateSession();
  useUserStore.setState({ bootstrapSession: vi.fn(async () => undefined), sessionState: 'anonymous', sessionError: '' });
});

describe('router/auth-permission', () => {
  it.each(['/', '/react/'])('keeps the complete anonymous return target under %s', async (base) => {
    renderGuard(base, 'user/profile?name=a%26b#identity');
    expect(await screen.findByTestId('login-location')).toHaveTextContent('/user/profile?name=a%26b#identity');
  });

  it('waits for session restoration before exposing protected content', async () => {
    useUserStore.setState({ sessionState: 'restoring', bootstrapReady: false });
    renderGuard();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-location')).not.toBeInTheDocument();
    useUserStore.setState({ token: 'memory-token', sessionState: 'authenticated', bootstrapReady: true });
    expect(await screen.findByText('Protected')).toBeInTheDocument();
  });

  it('renders a retryable error instead of treating unavailable restore as anonymous', async () => {
    const bootstrap = vi.fn(async () => undefined);
    useUserStore.setState({ sessionState: 'failed', sessionError: 'restore unavailable (503)', bootstrapSession: bootstrap });
    renderGuard();
    expect(await screen.findByText('restore unavailable (503)')).toBeInTheDocument();
    expect(screen.queryByTestId('login-location')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }));
    await waitFor(() => expect(bootstrap).toHaveBeenCalledWith(true));
  });

  it('runs one restore/user/routes flow under StrictMode before creating realtime channels', async () => {
    removeToken();
    const restore = vi.spyOn(browserApi, 'restoreBrowserSession').mockResolvedValue({ access_token: 'restored' });
    const getInfo = vi.fn(async () => undefined);
    const routes = vi.fn(async () => []);
    const realtime = vi.fn();
    useUserStore.setState({ bootstrapSession: initialBootstrap, sessionState: 'unknown', getInfo, initializeRealtimeChannels: realtime });
    usePermissionStore.setState({ generateRoutes: routes });
    renderGuard();
    expect(await screen.findByText('Protected')).toBeInTheDocument();
    expect(restore).toHaveBeenCalledTimes(1);
    expect(getInfo).toHaveBeenCalledTimes(1);
    expect(routes).toHaveBeenCalledTimes(1);
    expect(realtime).toHaveBeenCalledTimes(1);
    expect(getInfo.mock.invocationCallOrder[0]).toBeLessThan(routes.mock.invocationCallOrder[0]);
    expect(routes.mock.invocationCallOrder[0]).toBeLessThan(realtime.mock.invocationCallOrder[0]);
  });

  it('hides protected content and withholds the login page until DELETE finishes', async () => {
    let finishDelete!: () => void;
    vi.spyOn(browserApi, 'deleteBrowserSession').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishDelete = resolve;
        })
    );
    const bootstrap = vi.fn(async () => undefined);
    useUserStore.setState({ sessionState: 'authenticated', token: 'memory-token', bootstrapReady: true, bootstrapSession: bootstrap });
    renderGuard();
    expect(screen.getByText('Protected')).toBeInTheDocument();
    const logout = useUserStore.getState().logout();
    expect(await screen.findByRole('status')).toHaveTextContent('正在退出');
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-location')).not.toBeInTheDocument();
    bootstrap.mockClear();
    await Promise.resolve();
    expect(bootstrap).not.toHaveBeenCalled();
    finishDelete();
    await logout;
    expect(await screen.findByTestId('login-location')).toBeInTheDocument();
    expect(useUserStore.getState().logoutState).toBe('idle');
  });

  it('shows an explicit logout failure and retries deletion instead of restoring or showing login', async () => {
    const remove = vi
      .spyOn(browserApi, 'deleteBrowserSession')
      .mockRejectedValueOnce(new Error('delete unavailable'))
      .mockResolvedValueOnce(undefined);
    const bootstrap = vi.fn(async () => undefined);
    useUserStore.setState({ sessionState: 'authenticated', token: 'memory-token', bootstrapReady: true, bootstrapSession: bootstrap });
    renderGuard();
    await expect(useUserStore.getState().logout()).rejects.toThrow('delete unavailable');
    expect(await screen.findByText('退出未完成，服务端会话撤销未获确认，请重试退出')).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-location')).not.toBeInTheDocument();
    bootstrap.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '重试退出' }));
    expect(await screen.findByTestId('login-location')).toBeInTheDocument();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(bootstrap.mock.calls.every((args) => args.length === 0)).toBe(true);
  });

  it('does not bootstrap the old user on public OAuth callback', () => {
    const bootstrap = vi.fn();
    useUserStore.setState({ bootstrapSession: bootstrap, sessionState: 'unknown' });
    renderGuard('/', 'oauth/callback?loginTicket=ticket');
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('filters dynamic routes by permissions and roles', () => {
    useUserStore.setState({ permissions: ['system:user:list'], roles: ['admin'] });
    const routes: AppRoute[] = [
      { path: '/a', permissions: ['system:user:list'] },
      { path: '/b', roles: ['admin'] },
      { path: '/c', permissions: ['system:user:remove'] }
    ];
    expect(filterDynamicRoutes(routes).map(({ path }) => path)).toEqual(['/a', '/b']);
  });

  it('keeps authentication public paths explicit', () => {
    expect(isWhiteListRoute('/forgot-password')).toBe(true);
    expect(isWhiteListRoute('/oauth/callback')).toBe(true);
    expect(isWhiteListRoute('/system/user')).toBe(false);
    useUserStore.setState({ bootstrapSession: initialBootstrap });
  });
});
