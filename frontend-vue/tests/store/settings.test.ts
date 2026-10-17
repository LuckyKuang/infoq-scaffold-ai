import { createPinia, setActivePinia } from 'pinia';
import defaultSettings from '@/settings';
import { useSettingsStore } from '@/store/modules/settings';

vi.mock('@/utils/dynamicTitle', () => ({
  useDynamicTitle: vi.fn()
}));

const { useDynamicTitle } = await import('@/utils/dynamicTitle');

describe('store/settings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initializes state from defaults and updates title', () => {
    const store = useSettingsStore();

    expect(store.showSettings).toBe(defaultSettings.showSettings);
    expect(store.dark).toBe(defaultSettings.dark);
    expect(store.topNav).toBe(defaultSettings.topNav);

    store.setTitle('系统管理');
    expect(store.title).toBe('系统管理');
    expect(useDynamicTitle).toHaveBeenCalledTimes(1);
  });
});
