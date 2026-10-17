import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthGuard from '@/router/AuthGuard';
import { isWhiteListRoute } from '@/router/public-routes';
import { useUserStore } from '@/store/modules/user';
import { filterDynamicRoutes, usePermissionStore } from '@/store/modules/permission';
import type { AppRoute } from '@/types/router';

describe('router/auth-permission', () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({
      token: '',
      roles: [],
      permissions: [],
      initializeRealtimeChannels: vi.fn(),
      logout: vi.fn(async () => undefined)
    });
    usePermissionStore.setState({
      routes: [],
      sidebarRouters: []
    });
  });

  it('redirects to login when token is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/system/user']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
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
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('loads user info and routes when token exists and roles are empty', async () => {
    localStorage.setItem('Admin-Token', 'token-1');
    const getInfo = vi.fn(async () => undefined);
    const generateRoutes = vi.fn(async () => []);
    const initializeRealtimeChannels = vi.fn();

    useUserStore.setState({
      token: 'token-1',
      roles: [],
      getInfo,
      initializeRealtimeChannels
    });
    usePermissionStore.setState({
      generateRoutes
    });

    render(
      <MemoryRouter initialEntries={['/index']}>
        <Routes>
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
    );

    await waitFor(() => {
      expect(screen.getByText('Protected')).toBeInTheDocument();
      expect(getInfo).toHaveBeenCalledTimes(1);
      expect(generateRoutes).toHaveBeenCalledTimes(1);
      expect(initializeRealtimeChannels).toHaveBeenCalledTimes(1);
    });
  });

  it('clears session and redirects to login when user bootstrap fails', async () => {
    localStorage.setItem('Admin-Token', 'token-1');
    const getInfo = vi.fn(async () => {
      throw new Error('get-info-failed');
    });
    const logout = vi.fn(async () => undefined);
    const generateRoutes = vi.fn(async () => []);

    useUserStore.setState({
      token: 'token-1',
      roles: [],
      getInfo,
      logout
    });
    usePermissionStore.setState({
      generateRoutes
    });

    render(
      <MemoryRouter initialEntries={['/system/user?page=1']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
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
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(getInfo).toHaveBeenCalledTimes(1);
      expect(generateRoutes).not.toHaveBeenCalled();
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });

  it('filters dynamic routes by permissions and roles', () => {
    useUserStore.setState({
      permissions: ['system:user:list'],
      roles: ['admin']
    });

    const routes: AppRoute[] = [
      { path: '/a', permissions: ['system:user:list'] },
      { path: '/b', roles: ['admin'] },
      { path: '/c', permissions: ['system:user:remove'] }
    ];

    const result = filterDynamicRoutes(routes);
    expect(result.map((item) => item.path)).toEqual(['/a', '/b']);
  });

  it('treats forgot-password paths as public whitelist routes', () => {
    expect(isWhiteListRoute('/forgot-password')).toBe(true);
    expect(isWhiteListRoute('/forgot-password/reset')).toBe(true);
    expect(isWhiteListRoute('/oauth/callback')).toBe(true);
    expect(isWhiteListRoute('/system/user')).toBe(false);
  });
});
