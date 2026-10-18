import { getToken, setToken, removeToken, notifySessionChange, onSessionChange } from '@/utils/auth';

describe('utils/auth', () => {
  beforeEach(() => {
    removeToken();
    localStorage.clear();
  });

  it('keeps the token only in memory', () => {
    const write = vi.spyOn(localStorage, 'setItem');
    setToken('abc-token');
    expect(getToken()).toBe('abc-token');
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem('Admin-Token')).toBeNull();
    removeToken();
    expect(getToken()).toBeNull();
  });

  it('deletes the old token without reading or migrating it on startup', async () => {
    localStorage.setItem('Admin-Token', 'legacy-secret');
    const read = vi.spyOn(localStorage, 'getItem');
    vi.resetModules();
    const auth = await import('@/utils/auth');
    expect(read).not.toHaveBeenCalled();
    expect(auth.getToken()).toBeNull();
    expect(localStorage.getItem('Admin-Token')).toBeNull();
  });

  it('broadcasts only an action and isolates scope and clientId', () => {
    setToken('secret-token');
    const write = vi.spyOn(localStorage, 'setItem');
    notifySessionChange('logout');
    expect(write).toHaveBeenCalledWith('infoq-browser-session:vue:test-client-id', '{"action":"logout"}');
    expect(JSON.stringify(write.mock.calls)).not.toContain('secret-token');
    const listener = vi.fn();
    const stop = onSessionChange(listener);
    for (const key of ['infoq-browser-session:react:test-client-id', 'infoq-browser-session:vue:another-client']) {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: '{"action":"logout"}' }));
    }
    expect(listener).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: 'infoq-browser-session:vue:test-client-id', newValue: '{"action":"changed"}' }));
    expect(listener).toHaveBeenCalledWith('changed');
    stop();
    window.dispatchEvent(new StorageEvent('storage', { key: 'infoq-browser-session:vue:test-client-id', newValue: '{"action":"logout"}' }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
