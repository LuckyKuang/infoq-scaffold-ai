import defaultSettings from '@/settings';

const dynamicTitleMocks = vi.hoisted(() => {
  return {
    store: {
      dynamicTitle: true,
      title: '控制台'
    }
  };
});

vi.mock('@/store/modules/settings', () => ({
  useSettingsStore: vi.fn(() => dynamicTitleMocks.store)
}));

import { useDynamicTitle } from '@/utils/dynamicTitle';

describe('utils/dynamicTitle', () => {
  beforeEach(() => {
    (import.meta.env as Record<string, string>).VITE_APP_TITLE = 'InfoQ';
  });

  it('uses dynamic title when switch is enabled', () => {
    dynamicTitleMocks.store.dynamicTitle = true;
    dynamicTitleMocks.store.title = '系统监控';

    useDynamicTitle();
    expect(document.title).toBe('系统监控 - InfoQ');
  });

  it('falls back to default settings title when dynamic title is disabled', () => {
    dynamicTitleMocks.store.dynamicTitle = false;

    useDynamicTitle();
    expect(document.title).toBe((defaultSettings.title || '') as string);
  });
});
