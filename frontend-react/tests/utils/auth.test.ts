import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, removeToken, setToken } from '@/utils/auth';

describe('utils/auth memory boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    removeToken();
  });
  it('keeps token in memory and removes it on logout', () => {
    setToken('memory-token');
    expect(getToken()).toBe('memory-token');
    expect(localStorage.getItem('Admin-Token')).toBeNull();
    expect(sessionStorage.getItem('Admin-Token')).toBeNull();
    removeToken();
    expect(getToken()).toBe('');
  });
  it('clears historical persisted tokens at startup without loading them', async () => {
    localStorage.setItem('Admin-Token', 'legacy');
    sessionStorage.setItem('Admin-Token', 'legacy-session');
    vi.resetModules();
    const fresh = await import('@/utils/auth');
    expect(fresh.getToken()).toBe('');
    expect(localStorage.getItem('Admin-Token')).toBeNull();
    expect(sessionStorage.getItem('Admin-Token')).toBeNull();
  });
});
