import { createPinia, setActivePinia } from 'pinia';
import { useDictStore } from '@/store/modules/dict';

describe('store/dict', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('sets/gets/removes dict entries', () => {
    const store = useDictStore();

    expect(store.getDict('status')).toBeNull();
    expect(store.setDict('status', [{ label: '启用', value: '1' } as DictDataOption])).toBe(true);
    expect(store.getDict('status')).toEqual([{ label: '启用', value: '1' }]);

    expect(store.removeDict('status')).toBe(true);
    expect(store.getDict('status')).toBeNull();
  });

  it('handles invalid keys and clean', () => {
    const store = useDictStore();

    expect(store.getDict('')).toBeNull();
    expect(store.setDict('', [] as DictDataOption[])).toBe(false);
    expect(store.removeDict('')).toBe(false);

    store.setDict('a', [{ label: 'A', value: 'a' } as DictDataOption]);
    store.cleanDict();
    expect(store.getDict('a')).toBeNull();
  });

  it('returns false and logs error when setDict throws', () => {
    const store = useDictStore();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(store.dict as Map<string, unknown>, 'set').mockImplementation(() => {
      throw new Error('set-failed');
    });

    expect(store.setDict('status', [{ label: '启用', value: '1' } as DictDataOption])).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Error in setDict:', expect.any(Error));
  });

  it('returns false and logs error when removeDict throws', () => {
    const store = useDictStore();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(store.dict as Map<string, unknown>, 'delete').mockImplementation(() => {
      throw new Error('delete-failed');
    });

    expect(store.removeDict('status')).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Error in removeDict:', expect.any(Error));
  });
});
