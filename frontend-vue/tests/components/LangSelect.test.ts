import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { ElMessage } from 'element-plus/es';
import LangSelect from '@/components/LangSelect/index.vue';

const langSelectMocks = vi.hoisted(() => ({
  locale: { value: 'zh_CN' },
  appStore: {
    language: 'zh_CN',
    changeLanguage: vi.fn()
  }
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: langSelectMocks.locale
  })
}));

vi.mock('@/store/modules/app', () => ({
  useAppStore: () => langSelectMocks.appStore
}));

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

const ElDropdownStub = defineComponent({
  name: 'ElDropdown',
  emits: ['command'],
  setup(_, { slots, emit }) {
    return () =>
      h('div', { class: 'el-dropdown-stub' }, [
        h(
          'button',
          {
            class: 'switch-to-en',
            onClick: () => emit('command', 'en_US')
          },
          'switch'
        ),
        slots.default?.(),
        slots.dropdown?.()
      ]);
  }
});

describe('components/LangSelect', () => {
  beforeEach(() => {
    langSelectMocks.locale.value = 'zh_CN';
    langSelectMocks.appStore.language = 'zh_CN';
    langSelectMocks.appStore.changeLanguage.mockClear();
  });

  it('switches language and shows success message', async () => {
    const wrapper = mount(LangSelect, {
      global: {
        stubs: {
          'el-dropdown': ElDropdownStub,
          'el-dropdown-menu': passthroughStub('ElDropdownMenu'),
          'el-dropdown-item': passthroughStub('ElDropdownItem'),
          'svg-icon': true
        }
      }
    });

    await wrapper.find('button.switch-to-en').trigger('click');

    expect(langSelectMocks.locale.value).toBe('en_US');
    expect(langSelectMocks.appStore.changeLanguage).toHaveBeenCalledTimes(1);
    expect(langSelectMocks.appStore.changeLanguage).toHaveBeenCalledWith('en_US');
    expect(ElMessage.success).toHaveBeenCalledTimes(1);
    expect(ElMessage.success).toHaveBeenCalledWith('Switch Language Successful!');
  });
});
