import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import DictTag from '@/components/DictTag/index.vue';

const ElTagStub = defineComponent({
  name: 'ElTag',
  setup(_, { slots }) {
    return () => h('span', { class: 'el-tag-stub' }, slots.default?.());
  }
});

describe('components/DictTag', () => {
  it('renders plain text when tag type is default and class is empty', () => {
    const wrapper = mount(DictTag, {
      props: {
        options: [{ label: '正常', value: '0', elTagType: 'default', elTagClass: '' }],
        value: '0'
      },
      global: {
        stubs: {
          'el-tag': ElTagStub
        }
      }
    });

    expect(wrapper.text()).toContain('正常');
    expect(wrapper.find('.el-tag-stub').exists()).toBe(false);
  });

  it('renders el-tag for non-default tag style', () => {
    const wrapper = mount(DictTag, {
      props: {
        options: [{ label: '停用', value: '1', elTagType: 'danger', elTagClass: 'danger-tag' }],
        value: '1'
      },
      global: {
        stubs: {
          'el-tag': ElTagStub
        }
      }
    });

    expect(wrapper.find('.el-tag-stub').exists()).toBe(true);
    expect(wrapper.text()).toContain('停用');
  });

  it('shows unmatched values when showValue is true', () => {
    const wrapper = mount(DictTag, {
      props: {
        options: [{ label: '启用', value: '1', elTagType: 'default', elTagClass: '' }],
        value: '1,2',
        separator: ',',
        showValue: true
      },
      global: {
        stubs: {
          'el-tag': ElTagStub
        }
      }
    });

    expect(wrapper.text()).toContain('启用');
    expect(wrapper.text()).toContain('2');
  });

  it('hides unmatched values when showValue is false', () => {
    const wrapper = mount(DictTag, {
      props: {
        options: [{ label: '启用', value: '1', elTagType: 'default', elTagClass: '' }],
        value: ['1', '2'],
        showValue: false
      },
      global: {
        stubs: {
          'el-tag': ElTagStub
        }
      }
    });

    expect(wrapper.text()).toContain('启用');
    expect(wrapper.text()).not.toContain('2');
  });

  it('concats multiple unmatched values via reducer branch', () => {
    const wrapper = mount(DictTag, {
      props: {
        options: [{ label: '启用', value: '1', elTagType: 'default', elTagClass: '' }],
        value: '1,2,3',
        separator: ',',
        showValue: true
      },
      global: {
        stubs: {
          'el-tag': ElTagStub
        }
      }
    });

    expect(wrapper.text()).toContain('2');
    expect(wrapper.text()).toContain('3');
  });
});
