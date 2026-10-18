import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import App from '@/App.vue';

const appMocks = vi.hoisted(() => ({
  appStore: {
    locale: { name: 'zh-cn-locale' },
    size: 'small'
  },
  settingsStore: {
    theme: '#123456'
  },
  userStore: { bootstrapState: 'authenticated', bootstrapError: '' },
  route: { path: '/index' },
  handleThemeStyle: vi.fn()
}));

vi.mock('@/store/modules/user', () => ({ useUserStore: () => appMocks.userStore }));
vi.mock('vue-router', () => ({ useRoute: () => appMocks.route }));

vi.mock('@/store/modules/app', () => ({
  useAppStore: () => appMocks.appStore
}));

vi.mock('@/store/modules/settings', () => ({
  useSettingsStore: () => appMocks.settingsStore
}));

vi.mock('@/utils/theme', () => ({
  handleThemeStyle: appMocks.handleThemeStyle
}));

const ElConfigProviderStub = defineComponent({
  name: 'ElConfigProvider',
  props: {
    locale: {
      type: Object,
      default: () => ({})
    },
    size: {
      type: String,
      default: ''
    }
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: 'el-config-provider-stub',
          'data-size': props.size,
          'data-locale': (props.locale as Record<string, string>).name || ''
        },
        slots.default?.()
      );
  }
});

describe('App.vue', () => {
  it('passes locale and size to config provider and initializes theme style on mount', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'el-config-provider': ElConfigProviderStub,
          'el-result': true,
          'el-button': true,
          'router-view': true
        },
        directives: { loading: {} }
      }
    });

    await nextTick();
    await nextTick();

    const provider = wrapper.find('.el-config-provider-stub');
    expect(provider.attributes('data-size')).toBe('small');
    expect(provider.attributes('data-locale')).toBe('zh-cn-locale');
    expect(appMocks.handleThemeStyle).toHaveBeenCalledTimes(1);
    expect(appMocks.handleThemeStyle).toHaveBeenCalledWith('#123456');
  });

  it.each(['restoring', 'failed', 'anonymous'])('does not mount protected content while %s', (state) => {
    appMocks.userStore.bootstrapState = state;
    appMocks.userStore.bootstrapError = '会话依赖不可用';
    const wrapper = mount(App, {
      global: {
        stubs: { 'el-config-provider': ElConfigProviderStub, 'el-result': true, 'el-button': true, 'router-view': true },
        directives: { loading: {} }
      }
    });
    expect(wrapper.find('router-view-stub').exists()).toBe(false);
    if (state === 'failed') expect(wrapper.find('el-result-stub').attributes('sub-title')).toBe('会话依赖不可用');
    else if (state === 'restoring') expect(wrapper.find('[aria-label="正在恢复会话"]').exists()).toBe(true);
    else expect(wrapper.find('el-result-stub').attributes('title')).toBe('会话已结束');
    appMocks.userStore.bootstrapState = 'authenticated';
  });
});
