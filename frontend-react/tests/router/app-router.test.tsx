import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/pages/forgot-password', () => ({
  default: () => <div>Forgot Password Route</div>
}));

const { default: AppRouter } = await import('@/router/AppRouter');

describe('router/AppRouter', () => {
  it('renders the fixed forgot-password public route', async () => {
    window.history.replaceState({}, '', '/forgot-password');

    render(<AppRouter />);

    await waitFor(() => {
      expect(screen.getByText('Forgot Password Route')).toBeInTheDocument();
    });
  });
});
