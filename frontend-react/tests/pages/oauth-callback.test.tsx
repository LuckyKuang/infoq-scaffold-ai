import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import OAuthCallbackPage from '@/pages/oauth-callback';
import { useUserStore } from '@/store/modules/user';

describe('OAuth callback redirect boundary', () => {
  const exchange = vi.fn();
  beforeEach(() => {
    exchange.mockResolvedValue(undefined);
    useUserStore.setState({ loginByOAuthTicket: exchange });
  });
  afterEach(() => vi.unstubAllEnvs());

  function Destination() {
    const location = useLocation();
    return <div data-testid="destination">{location.pathname + location.search + location.hash}</div>;
  }
  function mountCallback(redirect?: string, base = '/') {
    vi.stubEnv('BASE_URL', base);
    const query = new URLSearchParams({ loginTicket: 'fixture-ticket' });
    if (redirect !== undefined) query.set('redirect', redirect);
    return render(
      <MemoryRouter basename={base} initialEntries={[`${base}oauth/callback?${query}`]}>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it.each(['/', '/react/'])('exchanges the ticket and navigates inside %s once', async (base) => {
    const target = '/user/profile?name=a%26b#identity';
    mountCallback(base === '/' ? target : `/react${target}`, base);
    expect(await screen.findByTestId('destination')).toHaveTextContent(target);
    expect(exchange).toHaveBeenCalledExactlyOnceWith('fixture-ticket');
  });

  it('defaults an omitted redirect to /index', async () => {
    mountCallback();
    expect(await screen.findByTestId('destination')).toHaveTextContent('/index');
  });

  it('rejects duplicate redirect query values before consuming the ticket', async () => {
    render(<MemoryRouter initialEntries={['/oauth/callback?loginTicket=fixture&redirect=%2Findex&redirect=%2Fuser%2Fprofile']}><OAuthCallbackPage /></MemoryRouter>);
    expect(await screen.findByText('登录回跳地址无效，请从站内页面重新进入')).toBeInTheDocument();
    expect(exchange).not.toHaveBeenCalled();
  });

  it.each(['https://evil.test', '//evil.test', '/%252fevil.test', '/%5cother', '/p%0dnext', '/p%', '', '/a/../outside', '/a%3F/%2e%2e/%2e%2e/outside'])('rejects %j before consuming the ticket', async (target) => {
    mountCallback(target);
    expect(await screen.findByText('登录回跳地址无效，请从站内页面重新进入')).toBeInTheDocument();
    expect(exchange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
  });
});
