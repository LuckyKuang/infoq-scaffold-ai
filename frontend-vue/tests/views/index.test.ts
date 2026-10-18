import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import IndexView from '@/views/index.vue';

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

describe('views/index', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders home title', () => {
    const wrapper = mount(IndexView, {
      global: {
        plugins: [createPinia()],
        stubs: {
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-card': passthroughStub('ElCard'),
          'el-button': passthroughStub('ElButton'),
          'el-divider': true
        }
      }
    });

    expect(wrapper.text()).toContain('infoq-scaffold-backend后台管理系统');
  });
});
