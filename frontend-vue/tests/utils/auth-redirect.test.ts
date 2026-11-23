import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
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
    '',
    ' ',
    ' /index',
    '/index ',
    '/index%20',
    '/index%EF%BB%BF',
    'https://evil.test',
    '//evil.test',
    '%2F%2Fevil.test',
    '/%2fevil.test',
    '/%252fevil.test',
    '/%5cevil.test',
    '/\\evil.test',
    '/path\nnext',
    '/path%0dnext',
    '/path%250anext',
    '/path%7fnext',
    '/path%C2%85next',
    '/path%zz',
    '/path%',
    '/path%c0%af',
    '/path\uFFFD',
    '/../outside',
    '/a/../outside',
    '/%2e%2e/outside',
    '/a/%252e%252e/outside',
    '/a%3F/%2e%2e/%2e%2e/outside',
    '/a%23/%252e%252e/outside',
    '/a//other',
    ['/index', '/user/profile'],
    {},
    1
  ])('rejects invalid or ambiguous redirect %j', (target) => {
    expect(() => requireSafeRedirect(target)).toThrow('Invalid internal redirect');
  });

  it('rejects a repeated deployment prefix instead of retaining it in the app route', () => {
    expect(() => requireAppRedirect('/react/react/index', '/react/')).toThrow();
    expect(() => requireAppRedirect('/react/react?tab=1', '/react/')).toThrow();
  });

  it.each(['/system/user?tab=1', '/system/menu?q=a%26b&x=100%25#中文', '/index'])(
    'accepts the redirect that vue-router produces from raw fullPath %s',
    async (fullPath) => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }]
      });
      // 与 request.ts / Navbar.vue 一致：传入原始 fullPath，由 vue-router 负责一次编码。
      const target = router.resolve({ path: '/login', query: { redirect: fullPath } });
      await router.push(target.fullPath);
      expect(router.currentRoute.value.query.redirect).toBe(fullPath);
      expect(requireAppRedirect(router.currentRoute.value.query.redirect, '/')).toBe(fullPath);
    }
  );

  it('rejects the double-encoded redirect that pre-encoding the fullPath would produce', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }]
    });
    const target = router.resolve({ path: '/login', query: { redirect: encodeURIComponent('/system/user?tab=1') } });
    await router.push(target.fullPath);
    expect(() => requireSafeRedirect(router.currentRoute.value.query.redirect)).toThrow('Invalid internal redirect');
  });
});
