import { createPinia, setActivePinia } from 'pinia';
import zhCN from 'element-plus/es/locale/lang/zh-cn';
import enUS from 'element-plus/es/locale/lang/en';
import { useAppStore } from '@/store/modules/app';

describe('store/app', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('manages sidebar/device/size/language states', () => {
    const store = useAppStore();

    const openedBefore = store.sidebar.opened;
    store.toggleSideBar(false);
    expect(store.sidebar.opened).toBe(!openedBefore);
    expect(store.sidebar.withoutAnimation).toBe(false);

    store.toggleSideBar(false);
    expect(store.sidebar.opened).toBe(openedBefore);

    store.closeSideBar({ withoutAnimation: true });
    expect(store.sidebar.opened).toBe(false);
    expect(store.sidebar.withoutAnimation).toBe(true);

    store.toggleDevice('mobile');
    expect(store.device).toBe('mobile');

    store.setSize('small');
    expect(store.size).toBe('small');

    store.changeLanguage('en_US');
    expect(store.language).toBe('en_US');
    expect(store.locale).toBe(enUS);

    store.changeLanguage('zh_CN');
    expect(store.locale).toBe(zhCN);
  });

  it('blocks sidebar toggling when sidebar is hidden', () => {
    const store = useAppStore();
    const openedBefore = store.sidebar.opened;
    store.toggleSideBarHide(true);
    const result = store.toggleSideBar(true);

    expect(result).toBe(false);
    expect(store.sidebar.opened).toBe(openedBefore);
  });
});
