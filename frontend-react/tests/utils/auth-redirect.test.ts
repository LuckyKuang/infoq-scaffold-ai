import { describe, expect, it } from 'vitest';
import { requireAppRedirect, requireSafeRedirect, toDeploymentRedirect } from '@/utils/auth-redirect';

describe('safe authentication redirects', () => {
  it('defaults only an absent target to the application index', () => {
    expect(requireAppRedirect(undefined, '/react/')).toBe('/index');
    expect(requireAppRedirect(null, '/')).toBe('/index');
    expect(toDeploymentRedirect(undefined, '/react/')).toBe('/react/index');
  });

  it.each(['/', '/react/', '/admin/team/'])('adds and removes deployment base %s once', (base) => {
    const target = '/user/profile?tab=oauth&name=a%26b#identity';
    const browserTarget = base === '/' ? target : `${base.slice(0, -1)}${target}`;
    expect(toDeploymentRedirect(target, base)).toBe(browserTarget);
    expect(toDeploymentRedirect(browserTarget, base)).toBe(browserTarget);
    expect(requireAppRedirect(browserTarget, base)).toBe(target);
    expect(requireAppRedirect(base.slice(0, -1) || '/', base)).toBe('/');
  });

  it('preserves safe encoded query/hash semantics and application route names', () => {
    for (const target of ['/system/menu?q=a%26b#中文', '/p?x=100%25&y=%2526', '/p?q=hello%20world', '/reactive/index']) {
      expect(requireSafeRedirect(target)).toBe(target);
    }
    expect(toDeploymentRedirect('/reactive/index', '/react/')).toBe('/react/reactive/index');
  });

  it.each([
    '', ' ', ' /index', '/index ', '/index%20', '/index%EF%BB%BF', 'https://evil.test', '//evil.test', '%2F%2Fevil.test', '/%2fevil.test',
    '/%252fevil.test', '/%5cevil.test', '/\\evil.test', '/path\nnext', '/path%0dnext', '/path%250anext',
    '/path%7fnext', '/path%C2%85next', '/path%zz', '/path%', '/path%c0%af', '/path\uFFFD', '/../outside', '/a/../outside',
    '/%2e%2e/outside', '/a/%252e%252e/outside', '/a%3F/%2e%2e/%2e%2e/outside', '/a%23/%252e%252e/outside', '/a//other', ['/index', '/user/profile'], {}, 1
  ])('rejects invalid or ambiguous redirect %j', (target) => {
    expect(() => requireSafeRedirect(target)).toThrow('Invalid internal redirect');
  });

  it('rejects a repeated deployment prefix instead of retaining it in the app route', () => {
    expect(() => requireAppRedirect('/react/react/index', '/react/')).toThrow();
    expect(() => requireAppRedirect('/react/react?tab=1', '/react/')).toThrow();
  });
});
