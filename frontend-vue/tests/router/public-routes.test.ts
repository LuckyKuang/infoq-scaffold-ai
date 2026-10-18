import { isPublicRoute } from '@/router/public-routes';

describe('shared public route boundary', () => {
  it.each(['/login', '/register', '/forgot-password', '/oauth/callback'])('allows public authentication entry %s', (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  it.each(['/index', '/system/user', '/message-center', '/user/profile', '/401'])('keeps protected page %s behind session bootstrap', (path) => {
    expect(isPublicRoute(path)).toBe(false);
  });
});
