import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import SizeSelect from '@/components/SizeSelect/index.vue';

const sizeSelectMocks = vi.hoisted(() => ({
  appStore: {
    size: 'default',
    setSize: vi.fn()
  }
}));

vi.mock('@/store/modules/app', () => ({
  useAppStore: () => sizeSelectMocks.appStore
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
            class: 'command-small',
            onClick: () => emit('command', 'small')
          },
          'emit-command'
        ),
        slots.default?.(),
        slots.dropdown?.()
      ]);
  }
});

describe('components/SizeSelect', () => {
  beforeEach(() => {
    sizeSelectMocks.appStore.size = 'default';
    sizeSelectMocks.appStore.setSize.mockClear();
  });

  it('changes size when dropdown command is emitted', async () => {
    const wrapper = mount(SizeSelect, {
      global: {
        stubs: {
          'el-dropdown': ElDropdownStub,
          'el-dropdown-menu': passthroughStub('ElDropdownMenu'),
          'el-dropdown-item': passthroughStub('ElDropdownItem'),
          'svg-icon': true
        }
      }
    });

    expect(wrapper.text()).toContain('较大');
    expect(wrapper.text()).toContain('默认');
    expect(wrapper.text()).toContain('稍小');

    await wrapper.find('button.command-small').trigger('click');
    expect(sizeSelectMocks.appStore.setSize).toHaveBeenCalledTimes(1);
    expect(sizeSelectMocks.appStore.setSize).toHaveBeenCalledWith('small');
  });
});
