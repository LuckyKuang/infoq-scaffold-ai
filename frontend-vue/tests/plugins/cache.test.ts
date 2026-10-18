import cache from '@/plugins/cache';

describe('plugins/cache', () => {
  const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  const restoreStorages = () => {
    if (originalSessionStorage) {
      Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorage);
    }
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    }
  };

  afterEach(() => {
    restoreStorages();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('handles session cache set/get/remove', () => {
    cache.session.set('k1', 'v1');
    expect(cache.session.get('k1')).toBe('v1');

    cache.session.setJSON('k2', { a: 1 });
    expect(cache.session.getJSON('k2')).toEqual({ a: 1 });

    cache.session.remove('k1');
    expect(cache.session.get('k1')).toBeNull();
  });

  it('handles local cache set/get/remove', () => {
    cache.local.set('k1', 'v1');
    expect(cache.local.get('k1')).toBe('v1');

    cache.local.setJSON('k2', { b: 2 });
    expect(cache.local.getJSON('k2')).toEqual({ b: 2 });

    cache.local.remove('k1');
    expect(cache.local.get('k1')).toBeNull();
  });

  it('returns null when key is empty', () => {
    expect(cache.session.get(null as unknown as string)).toBeNull();
    expect(cache.local.get(null as unknown as string)).toBeNull();
  });

  it('returns null when JSON cache key is missing', () => {
    expect(cache.session.getJSON('missing-session-key')).toBeNull();
    expect(cache.local.getJSON('missing-local-key')).toBeNull();
  });

  it('gracefully no-ops when sessionStorage is unavailable', () => {
    vi.stubGlobal('sessionStorage', undefined);

    expect(() => cache.session.set('k1', 'v1')).not.toThrow();
    expect(cache.session.get('k1')).toBeNull();
  });

  it('gracefully no-ops when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(() => cache.local.set('k1', 'v1')).not.toThrow();
    expect(cache.local.get('k1')).toBeNull();
  });
});
