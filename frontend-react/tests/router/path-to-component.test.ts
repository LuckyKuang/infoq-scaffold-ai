import { describe, expect, it } from 'vitest';
import { convertPathToComponent } from '@/router/path-to-component';

describe('router/path-to-component', () => {
  it.each([
    ['/system/user-auth/role/100', 'system/user/authRole'],
    ['/system/role-auth/user/200', 'system/role/authUser'],
    ['/system/dict-data/index/300', 'system/dict/data'],
    ['/user/profile', 'system/user/profile/index']
  ])('maps %s to %s', (path, expected) => {
    expect(convertPathToComponent(path)).toBe(expected);
  });
});
