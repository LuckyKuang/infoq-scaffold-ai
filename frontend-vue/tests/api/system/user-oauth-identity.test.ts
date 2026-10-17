const oauthIdentityApiMocks = vi.hoisted(() => ({
  request: vi.fn()
}));

vi.mock('@/utils/request', () => ({
  default: oauthIdentityApiMocks.request
}));

import { getProfileOauthBindAuthorizeUrl, listProfileOauthIdentities, unbindProfileOauthIdentity } from '@/api/system/user';

describe('api/system/user OAuth identities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists identities and builds the provider authorization request', () => {
    listProfileOauthIdentities();
    getProfileOauthBindAuthorizeUrl('github', 'https://admin.example.com/user/profile');

    expect(oauthIdentityApiMocks.request).toHaveBeenNthCalledWith(1, {
      url: '/system/user/profile/oauth/identities',
      method: 'get'
    });
    expect(oauthIdentityApiMocks.request).toHaveBeenNthCalledWith(2, {
      url: '/system/user/profile/oauth/github/bind/authorize',
      method: 'get',
      params: { redirect: 'https://admin.example.com/user/profile' }
    });
  });

  it('unbinds with encryption and only includes a supplied password', () => {
    unbindProfileOauthIdentity(101);
    unbindProfileOauthIdentity(102, 'current-password');

    expect(oauthIdentityApiMocks.request).toHaveBeenNthCalledWith(1, {
      url: '/system/user/profile/oauth/identities/101/unbind',
      method: 'post',
      headers: {
        isEncrypt: true,
        repeatSubmit: false
      },
      data: undefined
    });
    expect(oauthIdentityApiMocks.request).toHaveBeenNthCalledWith(2, {
      url: '/system/user/profile/oauth/identities/102/unbind',
      method: 'post',
      headers: {
        isEncrypt: true,
        repeatSubmit: false
      },
      data: { currentPassword: 'current-password' }
    });
  });
});
