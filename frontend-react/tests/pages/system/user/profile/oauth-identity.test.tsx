import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OauthIdentityPanel from '@/pages/system/user/profile/oauthIdentity';

const oauthIdentityMocks = vi.hoisted(() => ({
  getOAuthProviders: vi.fn(),
  listProfileOauthIdentities: vi.fn(),
  getProfileOauthBindAuthorizeUrl: vi.fn(),
  unbindProfileOauthIdentity: vi.fn()
}));

vi.mock('@/api/login', () => ({
  getOAuthProviders: oauthIdentityMocks.getOAuthProviders
}));

vi.mock('@/api/system/user', () => ({
  listProfileOauthIdentities: oauthIdentityMocks.listProfileOauthIdentities,
  unbindProfileOauthIdentity: oauthIdentityMocks.unbindProfileOauthIdentity,
  getProfileOauthBindAuthorizeUrl: oauthIdentityMocks.getProfileOauthBindAuthorizeUrl
}));

describe('pages/system/user/profile/oauthIdentity', () => {
  afterEach(() => vi.unstubAllEnvs());
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

  it.each(['/', '/react/'])('requests binding with a site-relative target under %s', async (base) => {
    vi.stubEnv('BASE_URL', base);
    // 保持请求 pending，断言真实表单事件提交参数，不触发 jsdom 不支持的外部导航。
    oauthIdentityMocks.getProfileOauthBindAuthorizeUrl.mockReturnValue(new Promise(() => {}));
    render(<OauthIdentityPanel />);
    const bindButton = await screen.findByRole('button', { name: /绑定第三方账号/ });
    await waitFor(() => expect(bindButton).toBeEnabled());
    fireEvent.click(bindButton);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('GitHub', { selector: '.ant-select-item-option-content' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(oauthIdentityMocks.getProfileOauthBindAuthorizeUrl).toHaveBeenCalledExactlyOnceWith('github', `${base}user/profile`));
  });
});
