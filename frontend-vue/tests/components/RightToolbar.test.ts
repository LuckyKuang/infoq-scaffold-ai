import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import RightToolbar from '@/components/RightToolbar/index.vue';

const setChecked = vi.fn();

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

const ElButtonStub = defineComponent({
  name: 'ElButton',
  emits: ['click'],
  setup(_, { emit }) {
    return () =>
      h(
        'button',
        {
          class: 'el-btn',
          onClick: () => emit('click')
        },
        'btn'
      );
  }
});

const ElTreeStub = defineComponent({
  name: 'ElTree',
  emits: ['check'],
  setup(_, { emit, expose }) {
    expose({ setChecked });
    return () =>
      h(
        'button',
        {
          class: 'tree-check-btn',
          onClick: () => emit('check', null, { checkedKeys: ['name'] })
        },
        'check'
      );
  }
});

const ElPopoverStub = defineComponent({
  name: 'ElPopover',
  setup(_, { slots }) {
    return () =>
      h('div', { class: 'el-popover-stub' }, [
        h('div', { class: 'default-slot' }, slots.default?.()),
        h('div', { class: 'reference-slot' }, slots.reference?.())
      ]);
  }
});

describe('components/RightToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits search toggle and refresh events', async () => {
    const wrapper = mount(RightToolbar, {
      props: {
        showSearch: true,
        search: true
      },
      global: {
        stubs: {
          'el-row': passthroughStub('ElRow'),
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-popover': ElPopoverStub,
          'el-button': ElButtonStub,
          'el-tree': ElTreeStub
        }
      }
    });

    const buttons = wrapper.findAll('button.el-btn');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('update:showSearch')?.[0]).toEqual([false]);
    expect(wrapper.emitted('queryTable')?.length).toBe(1);
    expect(wrapper.attributes('style')).toContain('margin-right: 5px;');
  });

  it('syncs column visibility and checks visible columns on mounted', async () => {
    const columns = [
      { key: 'name', label: '名称', visible: true },
      { key: 'age', label: '年龄', visible: true }
    ];

    const wrapper = mount(RightToolbar, {
      props: {
        search: false,
        columns
      },
      global: {
        stubs: {
          'el-row': passthroughStub('ElRow'),
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-popover': ElPopoverStub,
          'el-button': ElButtonStub,
          'el-tree': ElTreeStub
        }
      }
    });

    await nextTick();
    expect(setChecked).toHaveBeenCalledWith('name', true, false);
    expect(setChecked).toHaveBeenCalledWith('age', true, false);

    await wrapper.find('.tree-check-btn').trigger('click');
    expect(columns[0].visible).toBe(true);
    expect(columns[1].visible).toBe(false);
  });
});
