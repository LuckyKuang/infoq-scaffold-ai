import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import IconSelect from '@/components/IconSelect/index.vue';

vi.mock('@/components/IconSelect/requireIcons', () => ({
  default: ['user', 'search', 'setting']
}));

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

const ElInputStub = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue', 'input', 'click'],
  setup(props, { emit, slots }) {
    return () =>
      h('div', { class: 'el-input-stub-wrap' }, [
        slots.prepend?.(),
        h('input', {
          class: 'el-input-stub',
          placeholder: props.placeholder,
          value: props.modelValue,
          onClick: () => emit('click'),
          onInput: (e: Event) => {
            const target = e.target as HTMLInputElement;
            emit('update:modelValue', target.value);
            emit('input');
          }
        })
      ]);
  }
});

describe('components/IconSelect', () => {
  it('filters icon list and emits selected icon', async () => {
    const wrapper = mount(IconSelect, {
      props: {
        modelValue: 'user'
      },
      global: {
        stubs: {
          'el-input': ElInputStub,
          'el-popover': defineComponent({
            name: 'ElPopover',
            setup(_, { slots }) {
              return () => h('div', [slots.reference?.(), slots.default?.()]);
            }
          }),
          'el-scrollbar': passthroughStub('ElScrollbar'),
          'el-tooltip': passthroughStub('ElTooltip'),
          'svg-icon': defineComponent({
            name: 'SvgIcon',
            props: {
              iconClass: {
                type: String,
                default: ''
              }
            },
            setup(props) {
              return () => h('i', { class: 'svg-icon-stub', 'data-icon': props.iconClass });
            }
          }),
          'i-ep-caret-top': true,
          'i-ep-caret-bottom': true
        }
      }
    });

    expect(wrapper.findAll('li.icon-item')).toHaveLength(3);

    const searchInput = wrapper.find('input[placeholder="搜索图标"]');
    await searchInput.setValue('sea');
    await nextTick();

    expect(wrapper.findAll('li.icon-item')).toHaveLength(1);

    await searchInput.setValue('');
    await nextTick();
    expect(wrapper.findAll('li.icon-item')).toHaveLength(3);

    await searchInput.setValue('sea');
    await nextTick();
    await wrapper.find('li.icon-item').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    const emits = wrapper.emitted('update:modelValue')!;
    expect(emits[emits.length - 1]).toEqual(['search']);
  });
});
