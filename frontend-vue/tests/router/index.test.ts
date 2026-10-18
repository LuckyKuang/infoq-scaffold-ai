import router, { constantRoutes, dynamicRoutes } from '@/router';
import type { RouteLocationNormalized } from 'vue-router';

describe('router/index', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('exposes expected constant and dynamic route definitions', () => {
    const paths = constantRoutes.map((route) => route.path);
    expect(paths).toContain('/login');
    expect(paths).toContain('/register');
    expect(paths).toContain('/forgot-password');
    expect(paths).toContain('/401');
    expect(paths).toContain('/redirect');
    expect(dynamicRoutes).toEqual([]);
  });

  it('applies scroll behavior with saved position fallback', () => {
    const scrollBehavior = router.options.scrollBehavior as NonNullable<typeof router.options.scrollBehavior>;
    const dummyRoute = {} as RouteLocationNormalized;
    const saved = { left: 20, top: 30 };

    expect(scrollBehavior(dummyRoute, dummyRoute, saved)).toEqual(saved);
    expect(scrollBehavior(dummyRoute, dummyRoute, null)).toEqual({ top: 0 });
  });

  it.each(['/', '/vue/', '/admin/team/'])('resolves navigation URLs using the Vite base %s', async (base) => {
    vi.stubEnv('BASE_URL', base);
    vi.resetModules();
    const { default: isolatedRouter } = await import('@/router');
    expect(isolatedRouter.options.history.base).toBe(base === '/' ? '' : base.slice(0, -1));
    expect(isolatedRouter.resolve('/user/profile?name=a%26b#identity').href).toBe(`${base}user/profile?name=a%26b#identity`);
  });
});
