import defaultSettings from '@/settings';
import { useSettingsStore } from '@/store/modules/settings';

/**
 * 动态修改标题
 */
export const useDynamicTitle = () => {
  const settingsStore = useSettingsStore();
  const appTitle = import.meta.env.VITE_APP_TITLE || '';
  if (settingsStore.dynamicTitle) {
    document.title = appTitle ? settingsStore.title + ' - ' + appTitle : settingsStore.title;
  } else {
    document.title = (defaultSettings.title || '') as string;
  }
};
