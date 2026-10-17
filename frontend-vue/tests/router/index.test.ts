import router, { constantRoutes, dynamicRoutes } from '@/router';
import type { RouteLocationNormalized } from 'vue-router';

describe('router/index', () => {
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
});
