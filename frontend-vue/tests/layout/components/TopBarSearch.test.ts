import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import SearchMenu from '@/layout/components/TopBar/search.vue';

const topBarSearchMocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  focus: vi.fn(),
  routes: [] as Array<Record<string, unknown>>
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: topBarSearchMocks.routerPush
  })
}));

vi.mock('@/store/modules/permission', () => ({
  usePermissionStore: () => ({
    routes: topBarSearchMocks.routes
  })
}));

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue'],
  setup(props, { slots }) {
    return () => (props.modelValue ? h('div', { class: 'el-dialog-stub' }, slots.footer?.()) : h('div'));
  }
});

const ElAutocompleteStub = defineComponent({
  name: 'ElAutocomplete',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    fetchSuggestions: {
      type: Function,
      default: undefined
    }
  },
  emits: ['update:modelValue', 'select'],
  setup(_, { emit, expose, slots }) {
    expose({
      focus: topBarSearchMocks.focus
    });
    return () =>
      h('div', { class: 'el-autocomplete-stub' }, [
        h(
          'button',
          {
            class: 'select-http',
            onClick: () =>
              emit('select', {
                path: 'https://docs.example.com'
              })
          },
          'select-http'
        ),
        h(
          'button',
          {
            class: 'select-local',
            onClick: () =>
              emit('select', {
                path: '/system/user'
              })
          },
          'select-local'
        ),
        h('div', { class: 'prefix-slot' }, slots.prefix?.()),
        h('div', { class: 'default-slot' }, slots.default?.({ item: { icon: 'user', title: '用户' } }))
      ]);
  }
});

describe('layout/components/TopBar/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    topBarSearchMocks.routes = reactive([
      {
        path: '/system',
        hidden: false,
        redirect: '/system/user',
        meta: {
          title: '系统',
          icon: 'system'
        },
        children: [
          {
            path: 'user',
            hidden: false,
            meta: {
              title: '用户',
              icon: 'user'
            }
          },
          {
            path: 'https://docs.example.com',
            hidden: false,
            meta: {
              title: '文档',
              icon: 'link'
            }
          }
        ]
      },
      {
        path: '/hidden',
        hidden: true,
        meta: {
          title: '隐藏'
        }
      }
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mountSearch = () =>
    mount(SearchMenu, {
      global: {
        stubs: {
          'el-dialog': ElDialogStub,
          'el-autocomplete': ElAutocompleteStub,
          'svg-icon': true
        }
      }
    });

  it('opens search dialog, focuses input and filters menu suggestions', async () => {
    const wrapper = mountSearch();
    const vm = wrapper.vm as unknown as { openSearch: () => void };
    vm.openSearch();
    await wrapper.vm.$nextTick();
    vi.runAllTimers();

    expect(wrapper.find('.el-dialog-stub').exists()).toBe(true);
    expect(topBarSearchMocks.focus).toHaveBeenCalledTimes(1);

    const autoProps = wrapper.findComponent(ElAutocompleteStub).props() as {
      fetchSuggestions: (keyword: string, cb: (options: unknown[]) => void) => void;
    };
    const callback = vi.fn();
    autoProps.fetchSuggestions('系统/用户', callback);
    expect(callback).toHaveBeenCalledWith([
      expect.objectContaining({
        path: '/system/user',
        title: '系统/用户'
      })
    ]);
  });

  it('handles http and local route selection branches', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const wrapper = mountSearch();
    const vm = wrapper.vm as unknown as { openSearch: () => void };
    vm.openSearch();
    await wrapper.vm.$nextTick();
    vi.runAllTimers();

    await wrapper.find('button.select-http').trigger('click');
    expect(openSpy).toHaveBeenCalledWith('https://docs.example.com', '_blank');
    expect(wrapper.find('.el-dialog-stub').exists()).toBe(false);

    vm.openSearch();
    await wrapper.vm.$nextTick();
    vi.runAllTimers();
    await wrapper.find('button.select-local').trigger('click');

    expect(topBarSearchMocks.routerPush).toHaveBeenCalledWith('/system/user');
    expect(wrapper.find('.el-dialog-stub').exists()).toBe(false);
    openSpy.mockRestore();
  });
});
