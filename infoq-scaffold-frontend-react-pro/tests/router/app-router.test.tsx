import routes from '@root/config/routes';
import {describe, expect, it} from 'vitest';

describe('config/routes', () => {
  it('keeps auth and recovery routes public', () => {
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/login',
          layout: false,
          component: './user/login',
        }),
        expect.objectContaining({
          path: '/register',
          layout: false,
          component: './register',
        }),
        expect.objectContaining({
          path: '/forgot-password',
          layout: false,
          component: './forgot-password',
        }),
        expect.objectContaining({
          path: '/oauth/callback',
          layout: false,
          component: './oauth-callback',
        }),
      ]),
    );
  });

  it('routes backend dynamic paths through BackendRouteView as the final catch-all', () => {
    expect(routes.at(-1)).toMatchObject({
      path: '*',
      component: './BackendRouteView',
    });
  });

  it('keeps the static home route title out of ProLayout intl lookup', () => {
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/index',
          name: '首页',
          locale: false,
        }),
      ]),
    );
  });
});
