import { beforeEach, describe, expect, it } from 'vitest';
import { getToken, removeToken, setToken } from '@/utils/auth';

describe('utils/auth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should set and get token', () => {
    setToken('abc-token');
    expect(getToken()).toBe('abc-token');
  });

  it('should remove token', () => {
    setToken('abc-token');
    removeToken();
    expect(getToken()).toBe('');
  });
});
