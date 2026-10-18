import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive, nextTick } from 'vue';
import AppMain from '@/layout/components/AppMain.vue';

const appMainMocks = vi.hoisted(() => ({
  route: {} as {
    path: string;
    meta: Record<string, unknown>;
    query: Record<string, unknown>;
  },
  settingsStore: {} as {
    animationEnable: boolean;
  },
  tagsViewStore: {
    cachedViews: ['DemoPage'],
    addIframeView: vi.fn()
  }
}));

vi.mock('vue-router', () => ({
  useRoute: () => appMainMocks.route
}));

vi.mock('@/store/modules/settings', () => ({
  useSettingsStore: () => appMainMocks.settingsStore
}));

vi.mock('@/store/modules/tagsView', () => ({
  useTagsViewStore: () => appMainMocks.tagsViewStore
}));

const DummyPage = defineComponent({
  name: 'DummyPage',
  setup() {
    return () => h('div', { class: 'dummy-page' }, 'page');
  }
});

const RouterViewStub = defineComponent({
  name: 'RouterView',
  setup(_, { slots }) {
    return () => slots.default?.({ Component: DummyPage, route: appMainMocks.route });
  }
});

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', { class: `${name}-stub` }, slots.default?.());
    }
  });

describe('layout/components/AppMain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMainMocks.route = reactive({
      path: '/demo',
      meta: {},
      query: {}
    });
    appMainMocks.settingsStore = reactive({
      animationEnable: false
    });
    appMainMocks.tagsViewStore.cachedViews = ['DemoPage'];
  });

  const mountAppMain = () =>
    mount(AppMain, {
      global: {
        config: {
          globalProperties: {
            animate: {
              animateList: ['animate-in'],
              defaultAnimate: 'animate-default'
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'router-view': RouterViewStub,
          transition: passthroughStub('Transition'),
          'keep-alive': passthroughStub('KeepAlive'),
          'iframe-toggle': true
        }
      }
    });

  it('adds iframe view when route meta has link and reacts to later changes', async () => {
    appMainMocks.route.meta = {
      link: 'https://docs.example.com'
    };

    mountAppMain();
    expect(appMainMocks.tagsViewStore.addIframeView).toHaveBeenCalledWith(appMainMocks.route);

    appMainMocks.tagsViewStore.addIframeView.mockClear();
    appMainMocks.route.meta = {};
    await nextTick();
    expect(appMainMocks.tagsViewStore.addIframeView).not.toHaveBeenCalled();

    appMainMocks.route.meta = {
      link: 'https://guide.example.com'
    };
    await nextTick();
    expect(appMainMocks.tagsViewStore.addIframeView).toHaveBeenCalledWith(appMainMocks.route);
  });

  it('updates transition animate class when animation setting changes', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    appMainMocks.settingsStore.animationEnable = true;

    const wrapper = mountAppMain();
    const vm = wrapper.vm as unknown as { animate: string };
    await nextTick();

    expect(vm.animate).toBe('animate-in');

    appMainMocks.settingsStore.animationEnable = false;
    await nextTick();
    expect(vm.animate).toBe('animate-default');

    randomSpy.mockRestore();
  });
});
