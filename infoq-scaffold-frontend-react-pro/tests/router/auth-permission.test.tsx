import {beforeEach, describe, expect, it} from 'vitest';
import access from '@/access';
import auth, {setPermissionContext} from '@/utils/permission';

describe('access and runtime button permissions', () => {
  beforeEach(() => {
    setPermissionContext([], []);
  });

  it('grants admin role access through Umi access config', () => {
    const result = access({
      roles: ['admin'],
      permissions: [],
    });

    expect(result.canAdmin).toBe(true);
    expect(result.hasRole('tenant')).toBe(true);
    expect(result.hasRoleOr(['tenant', 'operator'])).toBe(true);
  });

  it('supports wildcard and exact permission checks', () => {
    const result = access({
      roles: [],
      permissions: ['system:user:list'],
    });

    expect(result.hasPermi('system:user:list')).toBe(true);
    expect(result.hasPermi('system:user:remove')).toBe(false);
    expect(result.hasPermiOr(['system:user:remove', 'system:user:list'])).toBe(
      true,
    );

    const wildcardResult = access({
      roles: [],
      permissions: ['*:*:*'],
    });
    expect(wildcardResult.hasPermi('system:user:remove')).toBe(true);
  });

  it('keeps page button auth helper in sync with runtime permissions', () => {
    setPermissionContext([], ['monitor:job:remove']);

    expect(auth.hasPermiOr(['monitor:job:remove'])).toBe(true);
    expect(auth.hasPermiOr(['monitor:job:export'])).toBe(false);
  });
});
