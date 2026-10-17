import type { RouteRecordRaw } from 'vue-router';

vi.mock('@/plugins/auth', () => ({
  default: {
    hasPermiOr: vi.fn((permissions: string[]) => permissions.includes('allow:permi')),
    hasRoleOr: vi.fn((roles: string[]) => roles.includes('admin'))
  }
}));

const permissionMod = await import('@/store/modules/permission');

describe('store/permission exported utils', () => {
  it('filters dynamic routes by permission and role', () => {
    const input = [
      { path: '/a', permissions: ['allow:permi'] },
      { path: '/b', permissions: ['deny:permi'] },
      { path: '/c', roles: ['admin'] },
      { path: '/d', roles: ['guest'] }
    ] as RouteRecordRaw[];

    const output = permissionMod.filterDynamicRoutes(input);
    expect(output.map((x) => x.path)).toEqual(['/a', '/c']);
  });

  it('loads existing view and returns undefined for missing one', () => {
    const loaded = permissionMod.loadView('index', 'IndexPage');
    const missing = permissionMod.loadView('not/exist/view', 'None');

    expect(loaded).toBeTruthy();
    expect(missing).toBeUndefined();
  });
});
