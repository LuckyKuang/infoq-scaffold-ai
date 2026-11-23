import { describe, expect, it, vi } from 'vitest';

const vueuseSpy = vi.hoisted(() => ({ useStorage: vi.fn() }));
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useStorage: vueuseSpy.useStorage
}));

import { getLanguage } from '@/lang';

describe('lang/getLanguage', () => {
  it('reads the persisted language and falls back to zh_CN without creating storage listeners per call', () => {
    localStorage.removeItem('language');
    expect(getLanguage()).toBe('zh_CN');

    localStorage.setItem('language', 'en_US');
    expect(getLanguage()).toBe('en_US');

    localStorage.setItem('language', '');
    expect(getLanguage()).toBe('zh_CN');

    for (let i = 0; i < 50; i++) getLanguage();
    expect(vueuseSpy.useStorage).not.toHaveBeenCalled();
  });
});
