import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OauthIdentityPanel from '@/pages/system/user/profile/oauthIdentity';

const oauthIdentityMocks = vi.hoisted(() => ({
  getOAuthProviders: vi.fn(),
  listProfileOauthIdentities: vi.fn(),
  unbindProfileOauthIdentity: vi.fn()
}));

vi.mock('@/api/login', () => ({
  getOAuthProviders: oauthIdentityMocks.getOAuthProviders
}));

vi.mock('@/api/system/user', () => ({
  listProfileOauthIdentities: oauthIdentityMocks.listProfileOauthIdentities,
  unbindProfileOauthIdentity: oauthIdentityMocks.unbindProfileOauthIdentity,
  getProfileOauthBindAuthorizeUrl: vi.fn()
}));

describe('pages/system/user/profile/oauthIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    oauthIdentityMocks.getOAuthProviders.mockResolvedValue({
      data: [{ providerCode: 'github', providerName: 'GitHub' }]
    });
    oauthIdentityMocks.listProfileOauthIdentities.mockResolvedValue({
      data: [
        {
          identityId: 101,
          providerCode: 'github',
          providerName: 'GitHub',
          status: '0',
          passwordConfirmationRequired: false
        }
      ]
    });
    oauthIdentityMocks.unbindProfileOauthIdentity.mockResolvedValue(undefined);
  });

  it('loads the current identities and available providers', async () => {
    render(<OauthIdentityPanel />);

    expect(await screen.findByText('GitHub')).toBeInTheDocument();
    await waitFor(() => {
      expect(oauthIdentityMocks.listProfileOauthIdentities).toHaveBeenCalledTimes(1);
      expect(oauthIdentityMocks.getOAuthProviders).toHaveBeenCalledTimes(1);
    });
  });

  it('unbinds an identity and reloads the server truth', async () => {
    oauthIdentityMocks.listProfileOauthIdentities
      .mockResolvedValueOnce({
        data: [
          {
            identityId: 101,
            providerCode: 'github',
            providerName: 'GitHub',
            status: '0',
            passwordConfirmationRequired: false
          }
        ]
      })
      .mockResolvedValueOnce({ data: [] });
    render(<OauthIdentityPanel />);

    await screen.findByText('GitHub');
    fireEvent.click(screen.getByRole('button', { name: /解绑/ }));
    expect(await screen.findByText('确认解绑 GitHub？')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(oauthIdentityMocks.unbindProfileOauthIdentity).toHaveBeenCalledWith(101, undefined);
      expect(oauthIdentityMocks.listProfileOauthIdentities).toHaveBeenCalledTimes(2);
    });
  });
});
