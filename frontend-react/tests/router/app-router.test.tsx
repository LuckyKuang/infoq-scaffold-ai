import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/pages/forgot-password', () => ({
  default: () => <div>Forgot Password Route</div>
}));

const { default: AppRouter } = await import('@/router/AppRouter');

describe('router/AppRouter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', '/');
  });
  it('renders the fixed forgot-password public route', async () => {
    window.history.replaceState({}, '', '/forgot-password');

    render(<AppRouter />);

    await waitFor(() => {
      expect(screen.getByText('Forgot Password Route')).toBeInTheDocument();
    });
  });

  it.each(['/', '/react/', '/admin/team/'])('opens and refreshes a public route under %s', async (base) => {
    vi.stubEnv('BASE_URL', base);
    const pathname = `${base}forgot-password`;
    window.history.replaceState({}, '', pathname);
    const view = render(<AppRouter />);
    expect(await screen.findByText('Forgot Password Route')).toBeInTheDocument();
    expect(window.location.pathname).toBe(pathname);
    view.unmount();
    render(<AppRouter />);
    expect(await screen.findByText('Forgot Password Route')).toBeInTheDocument();
    expect(window.location.pathname).toBe(pathname);
  });
});
