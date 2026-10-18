import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import Settings from '@/layout/components/Settings/index.vue';
import { SideThemeEnum } from '@/enums/SideThemeEnum';

const settingsMocks = vi.hoisted(() => ({
  appStore: {
    toggleSideBarHide: vi.fn()
  },
  settingsStore: {
    theme: '#409EFF',
    sideTheme: 'theme-dark',
    topNav: false,
    tagsView: true,
    tagsIcon: false,
    fixedHeader: false,
    sidebarLogo: true,
    dynamicTitle: false
  },
  permissionStore: {
    defaultRoutes: [{ path: '/dashboard' }],
    setSidebarRouters: vi.fn()
  },
  darkRef: {} as { value: boolean },
  storageRefs: new Map<string, { value: unknown }>(),
  useDynamicTitle: vi.fn(),
  handleThemeStyle: vi.fn(),
  modalLoading: vi.fn(),
  modalCloseLoading: vi.fn()
}));

vi.mock('@/store/modules/app', () => ({
  useAppStore: () => settingsMocks.appStore
}));

vi.mock('@/store/modules/settings', () => ({
  useSettingsStore: () => settingsMocks.settingsStore
}));

vi.mock('@/store/modules/permission', () => ({
  usePermissionStore: () => settingsMocks.permissionStore
}));

vi.mock('@/utils/dynamicTitle', () => ({
  useDynamicTitle: settingsMocks.useDynamicTitle
}));

vi.mock('@/utils/theme', () => ({
  handleThemeStyle: settingsMocks.handleThemeStyle
}));

vi.mock('@vueuse/core', () => ({
  useDark: () => settingsMocks.darkRef,
  useToggle: (target: { value: boolean }) => () => {
    target.value = !target.value;
  },
  useStorage: (key: string, initialValue: unknown) => {
    if (!settingsMocks.storageRefs.has(key)) {
      settingsMocks.storageRefs.set(key, { value: initialValue });
    }
    return settingsMocks.storageRefs.get(key)!;
  }
}));

const ElDrawerStub = defineComponent({
  name: 'ElDrawer',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: 'el-drawer-stub',
          'data-open': String(props.modelValue)
        },
        slots.default?.()
      );
  }
});

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', { class: `${name}-stub` }, slots.default?.());
    }
  });

describe('layout/components/Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMocks.settingsStore.theme = '#409EFF';
    settingsMocks.settingsStore.sideTheme = 'theme-dark';
    settingsMocks.settingsStore.topNav = false;
    settingsMocks.settingsStore.tagsView = true;
    settingsMocks.settingsStore.tagsIcon = false;
    settingsMocks.settingsStore.fixedHeader = false;
    settingsMocks.settingsStore.sidebarLogo = true;
    settingsMocks.settingsStore.dynamicTitle = false;
    settingsMocks.darkRef = ref(false);
    settingsMocks.storageRefs.clear();
  });

  const mountSettings = () =>
    mount(Settings, {
      global: {
        config: {
          globalProperties: {
            $modal: {
              loading: settingsMocks.modalLoading,
              closeLoading: settingsMocks.modalCloseLoading
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-drawer': ElDrawerStub,
          'el-color-picker': passthroughStub('ElColorPicker'),
          'el-switch': passthroughStub('ElSwitch'),
          'el-divider': true,
          'el-button': passthroughStub('ElButton')
        }
      }
    });

  it('handles top-nav/theme/title branches and dark-mode theme guard', async () => {
    const wrapper = mountSettings();
    const vm = wrapper.vm as unknown as {
      topNavChange: (val: boolean) => void;
      themeChange: (val: string) => void;
      dynamicTitleChange: () => void;
      handleTheme: (val: string) => void;
    };

    vm.topNavChange(false);
    expect(settingsMocks.appStore.toggleSideBarHide).toHaveBeenCalledWith(false);
    expect(settingsMocks.permissionStore.setSidebarRouters).toHaveBeenCalledWith(settingsMocks.permissionStore.defaultRoutes);

    vm.themeChange('#ff4500');
    expect(settingsMocks.settingsStore.theme).toBe('#ff4500');
    expect(settingsMocks.handleThemeStyle).toHaveBeenCalledWith('#ff4500');

    vm.dynamicTitleChange();
    expect(settingsMocks.useDynamicTitle).toHaveBeenCalledTimes(1);

    settingsMocks.darkRef.value = true;
    vm.handleTheme(SideThemeEnum.LIGHT);
    expect(settingsMocks.settingsStore.sideTheme).toBe(SideThemeEnum.DARK);

    settingsMocks.darkRef.value = false;
    vm.handleTheme(SideThemeEnum.LIGHT);
    expect(settingsMocks.settingsStore.sideTheme).toBe(SideThemeEnum.LIGHT);

    settingsMocks.darkRef.value = true;
    await nextTick();
    expect(settingsMocks.settingsStore.sideTheme).toBe(SideThemeEnum.DARK);

    settingsMocks.darkRef.value = false;
    await nextTick();
    expect(settingsMocks.settingsStore.sideTheme).toBe(SideThemeEnum.LIGHT);
  });

  it('saves layout setting into storage and closes loading after timer', () => {
    vi.useFakeTimers();
    const wrapper = mountSettings();
    const vm = wrapper.vm as unknown as { saveSetting: () => void };

    settingsMocks.settingsStore.topNav = true;
    settingsMocks.settingsStore.tagsView = false;
    settingsMocks.settingsStore.tagsIcon = true;
    settingsMocks.settingsStore.fixedHeader = true;
    settingsMocks.settingsStore.sidebarLogo = false;
    settingsMocks.settingsStore.dynamicTitle = true;
    settingsMocks.settingsStore.sideTheme = SideThemeEnum.LIGHT;
    settingsMocks.settingsStore.theme = '#00ced1';

    vm.saveSetting();

    expect(settingsMocks.modalLoading).toHaveBeenCalledWith('正在保存到本地，请稍候...');
    const layoutSetting = settingsMocks.storageRefs.get('layout-setting')?.value as Record<string, unknown>;
    expect(layoutSetting).toMatchObject({
      topNav: true,
      tagsView: false,
      tagsIcon: true,
      fixedHeader: true,
      sidebarLogo: false,
      dynamicTitle: true,
      sideTheme: SideThemeEnum.LIGHT,
      theme: '#00ced1'
    });

    vi.advanceTimersByTime(1000);
    expect(settingsMocks.modalCloseLoading).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('opens drawer and clears cached setting on reset', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((() => 0) as unknown as typeof setTimeout);
    const wrapper = mountSettings();
    const vm = wrapper.vm as unknown as {
      openSetting: () => void;
      resetSetting: () => void;
    };

    vm.openSetting();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.el-drawer-stub').attributes('data-open')).toBe('true');

    settingsMocks.storageRefs.set('layout-setting', { value: { topNav: true } });
    vm.resetSetting();

    expect(settingsMocks.modalLoading).toHaveBeenCalledWith('正在清除设置缓存并刷新，请稍候...');
    expect(settingsMocks.storageRefs.get('layout-setting')?.value).toBeNull();
    expect(timeoutSpy).toHaveBeenCalledWith('window.location.reload()', 1000);
    timeoutSpy.mockRestore();
  });
});
