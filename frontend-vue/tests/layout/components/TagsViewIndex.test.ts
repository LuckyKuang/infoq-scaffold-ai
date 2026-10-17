import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive, type ComponentCustomProperties } from 'vue';
import TagsView from '@/layout/components/TagsView/index.vue';

type TagRoute = {
  path: string;
  fullPath: string;
  query: Record<string, unknown>;
  meta: {
    title?: string;
    link?: string;
    affix?: boolean;
  };
  name: string;
};

const tagsViewMocks = vi.hoisted(() => ({
  route: {
    path: '/dashboard',
    fullPath: '/dashboard',
    query: {},
    meta: {},
    name: 'Dashboard'
  } as TagRoute,
  routerPush: vi.fn(() => Promise.resolve()),
  routerReplace: vi.fn(() => Promise.resolve()),
  refreshPage: vi.fn(),
  closePage: vi.fn(),
  closeRightPage: vi.fn(),
  closeLeftPage: vi.fn(),
  closeOtherPage: vi.fn(),
  closeAllPage: vi.fn(),
  moveToTarget: vi.fn(),
  addVisitedView: vi.fn(),
  addView: vi.fn(),
  updateVisitedView: vi.fn(),
  delIframeView: vi.fn(),
  getVisitedViews: vi.fn(),
  getRoutes: vi.fn(),
  settings: {
    theme: '#409eff',
    tagsIcon: true
  }
}));

vi.mock('vue-router', () => ({
  useRoute: () => tagsViewMocks.route,
  useRouter: () => ({
    push: tagsViewMocks.routerPush,
    replace: tagsViewMocks.routerReplace
  })
}));

vi.mock('@/store/modules/settings', () => ({
  useSettingsStore: () => tagsViewMocks.settings
}));

vi.mock('@/store/modules/permission', () => ({
  usePermissionStore: () => ({
    getRoutes: tagsViewMocks.getRoutes
  })
}));

vi.mock('@/store/modules/tagsView', () => ({
  useTagsViewStore: () => ({
    getVisitedViews: tagsViewMocks.getVisitedViews,
    addVisitedView: tagsViewMocks.addVisitedView,
    addView: tagsViewMocks.addView,
    updateVisitedView: tagsViewMocks.updateVisitedView,
    delIframeView: tagsViewMocks.delIframeView
  })
}));

const ScrollPaneStub = defineComponent({
  name: 'ScrollPane',
  emits: ['scroll'],
  setup(_, { slots, emit, expose }) {
    expose({
      moveToTarget: tagsViewMocks.moveToTarget
    });
    return () =>
      h('div', { class: 'scroll-pane-stub' }, [
        h(
          'button',
          {
            class: 'emit-scroll',
            onClick: () => emit('scroll')
          },
          'emit-scroll'
        ),
        slots.default?.()
      ]);
  }
});

const RouterLinkStub = defineComponent({
  name: 'RouterLink',
  props: {
    to: {
      type: [String, Object],
      default: ''
    }
  },
  setup(_, { slots, attrs }) {
    return () =>
      h(
        'a',
        {
          class: attrs.class as string,
          style: attrs.style as Record<string, string>,
          'data-path': (attrs as Record<string, unknown>)['data-path'],
          onContextmenu: (attrs as Record<string, unknown>).onContextmenu,
          onClick: (attrs as Record<string, unknown>).onClick,
          onMouseup: (attrs as Record<string, unknown>).onMouseup
        },
        slots.default?.()
      );
  }
});

const createView = (path: string, fullPath?: string, options: Record<string, unknown> = {}) => ({
  path,
  fullPath: fullPath || path,
  title: options.title || path,
  name: options.name || path.replace(/\//g, '') || 'view',
  meta: options.meta || {},
  query: options.query || {},
  hash: '',
  matched: options.matched || [],
  params: options.params || {},
  redirectedFrom: undefined
});

describe('layout/components/TagsView/index', () => {
  let getRectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tagsViewMocks.route = reactive({
      path: '/dashboard',
      fullPath: '/dashboard',
      query: {},
      meta: {},
      name: 'Dashboard'
    }) as TagRoute;
    tagsViewMocks.getRoutes.mockReturnValue([
      {
        path: '/index',
        name: 'Index',
        meta: {
          title: '首页',
          affix: true
        }
      },
      {
        path: '/system',
        name: 'System',
        children: [
          {
            path: 'user',
            name: 'User',
            meta: {
              title: '用户'
            }
          }
        ]
      }
    ]);
    tagsViewMocks.getVisitedViews.mockReturnValue([
      createView('/index', '/index', {
        name: 'Index',
        meta: { affix: true },
        title: '首页'
      }),
      createView('/a', '/a', { title: 'A' }),
      createView('/b', '/b', { title: 'B', name: 'Dashboard' }),
      createView('/c', '/c', { title: 'C' })
    ]);
    tagsViewMocks.closePage.mockResolvedValue({
      visitedViews: [createView('/index', '/index', { meta: { affix: true } }), createView('/a', '/a')]
    });
    tagsViewMocks.closeRightPage.mockResolvedValue([createView('/index', '/index'), createView('/a', '/a'), createView('/b', '/b')]);
    tagsViewMocks.closeLeftPage.mockResolvedValue([createView('/index', '/index'), createView('/b', '/b'), createView('/c', '/c')]);
    tagsViewMocks.closeOtherPage.mockResolvedValue(undefined);
    tagsViewMocks.closeAllPage.mockResolvedValue({
      visitedViews: []
    });

    getRectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 0,
      width: 200,
      height: 40,
      top: 0,
      left: 10,
      right: 210,
      bottom: 40,
      toJSON: () => ({})
    } as DOMRect);
  });

  afterEach(() => {
    getRectSpy.mockRestore();
  });

  const mountView = () =>
    mount(TagsView, {
      global: {
        config: {
          globalProperties: {
            $tab: {
              refreshPage: tagsViewMocks.refreshPage,
              closePage: tagsViewMocks.closePage,
              closeRightPage: tagsViewMocks.closeRightPage,
              closeLeftPage: tagsViewMocks.closeLeftPage,
              closeOtherPage: tagsViewMocks.closeOtherPage,
              closeAllPage: tagsViewMocks.closeAllPage
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown> as ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'scroll-pane': ScrollPaneStub,
          'router-link': RouterLinkStub,
          'svg-icon': true,
          close: true,
          'refresh-right': true,
          'circle-close': true,
          back: true,
          right: true
        }
      }
    });

  it('handles refresh and close-current with route fallback navigation', async () => {
    tagsViewMocks.route.path = '/b';
    tagsViewMocks.route.fullPath = '/b';
    tagsViewMocks.route.meta = {
      link: 'https://docs.example.com'
    };
    const wrapper = mountView();
    Object.defineProperty((wrapper.vm as { $el: HTMLElement }).$el, 'offsetWidth', {
      configurable: true,
      value: 200
    });

    await wrapper.find('a[data-path="/b"]').trigger('contextmenu', { clientX: 500, clientY: 120 });
    expect(wrapper.find('ul.contextmenu').attributes('style')).toContain('left: 95px');

    const refreshItem = wrapper.findAll('ul.contextmenu li').find((item) => item.text().includes('刷新页面'));
    expect(refreshItem).toBeDefined();
    await refreshItem!.trigger('click');

    expect(tagsViewMocks.refreshPage).toHaveBeenCalledWith(expect.objectContaining({ path: '/b' }));
    expect(tagsViewMocks.delIframeView).toHaveBeenCalledWith(tagsViewMocks.route);

    const closeCurrentItem = wrapper.findAll('ul.contextmenu li').find((item) => item.text().includes('关闭当前'));
    expect(closeCurrentItem).toBeDefined();
    await closeCurrentItem!.trigger('click');
    await flushPromises();

    expect(tagsViewMocks.closePage).toHaveBeenCalledWith(expect.objectContaining({ path: '/b' }));
    expect(tagsViewMocks.routerPush).toHaveBeenCalledWith('/a');
  });

  it('handles close-right and close-left with last-view fallback', async () => {
    tagsViewMocks.route.path = '/current';
    tagsViewMocks.route.fullPath = '/current';
    const wrapper = mountView();
    Object.defineProperty((wrapper.vm as { $el: HTMLElement }).$el, 'offsetWidth', {
      configurable: true,
      value: 200
    });

    await wrapper.find('a[data-path="/b"]').trigger('contextmenu', { clientX: 120, clientY: 90 });

    const closeLeftItem = wrapper.findAll('ul.contextmenu li').find((item) => item.text().includes('关闭左侧'));
    const closeRightItem = wrapper.findAll('ul.contextmenu li').find((item) => item.text().includes('关闭右侧'));
    expect(closeLeftItem).toBeDefined();
    expect(closeRightItem).toBeDefined();

    await closeRightItem!.trigger('click');
    await flushPromises();
    await closeLeftItem!.trigger('click');
    await flushPromises();

    expect(tagsViewMocks.closeRightPage).toHaveBeenCalledWith(expect.objectContaining({ path: '/b' }));
    expect(tagsViewMocks.closeLeftPage).toHaveBeenCalledWith(expect.objectContaining({ path: '/b' }));
    expect(tagsViewMocks.routerPush).toHaveBeenCalledWith('/b');
    expect(tagsViewMocks.routerPush).toHaveBeenCalledWith('/c');
  });

  it('handles close-others and updates active tag position', async () => {
    tagsViewMocks.route.path = '/b';
    tagsViewMocks.route.fullPath = '/b?x=1';
    const wrapper = mountView();
    Object.defineProperty((wrapper.vm as { $el: HTMLElement }).$el, 'offsetWidth', {
      configurable: true,
      value: 200
    });

    await wrapper.find('a[data-path="/b"]').trigger('contextmenu', { clientX: 140, clientY: 90 });
    const closeOthersItem = wrapper.findAll('ul.contextmenu li').find((item) => item.text().includes('关闭其他'));
    expect(closeOthersItem).toBeDefined();
    await closeOthersItem!.trigger('click');
    await flushPromises();

    expect(tagsViewMocks.closeOtherPage).toHaveBeenCalledWith(expect.objectContaining({ path: '/b' }));
    expect(tagsViewMocks.moveToTarget).toHaveBeenCalledWith(expect.objectContaining({ path: '/b' }));
    expect(tagsViewMocks.updateVisitedView).toHaveBeenCalledWith(tagsViewMocks.route);
  });

  it('handles close-all and dashboard fallback redirect branch', async () => {
    tagsViewMocks.route.path = '/dashboard';
    tagsViewMocks.route.fullPath = '/dashboard';
    tagsViewMocks.route.name = 'Dashboard';
    tagsViewMocks.getVisitedViews.mockReturnValue([
      createView('/index', '/index', {
        name: 'Index',
        meta: { affix: true },
        title: '首页'
      }),
      createView('/dashboard', '/dashboard', { name: 'Dashboard', title: '面板' })
    ]);

    const wrapper = mountView();
    Object.defineProperty((wrapper.vm as { $el: HTMLElement }).$el, 'offsetWidth', {
      configurable: true,
      value: 200
    });

    await wrapper.find('a[data-path="/dashboard"]').trigger('contextmenu', { clientX: 120, clientY: 90 });
    const closeAllItem = wrapper.findAll('ul.contextmenu li').find((item) => item.text().includes('全部关闭'));
    expect(closeAllItem).toBeDefined();
    await closeAllItem!.trigger('click');
    await flushPromises();

    expect(tagsViewMocks.closeAllPage).toHaveBeenCalledTimes(1);
    expect(tagsViewMocks.routerReplace).toHaveBeenCalledWith({
      path: '/redirect/dashboard'
    });
  });

  it('covers route watcher, middle-click close and menu close handlers', async () => {
    tagsViewMocks.route.query = {
      title: '动态标题'
    };
    tagsViewMocks.route.meta = {};
    tagsViewMocks.getRoutes.mockReturnValue([
      {
        path: '/index',
        name: 'Index',
        meta: {
          title: '首页',
          affix: true
        }
      },
      {
        path: '/system',
        name: 'System',
        children: [
          {
            path: 'inner',
            name: 'Inner',
            meta: {
              title: '内页',
              affix: true
            }
          }
        ]
      }
    ]);
    const wrapper = mountView();
    Object.defineProperty((wrapper.vm as { $el: HTMLElement }).$el, 'offsetWidth', {
      configurable: true,
      value: 200
    });
    await flushPromises();

    tagsViewMocks.route.path = '/a';
    tagsViewMocks.route.fullPath = '/a?title=动态标题';
    await flushPromises();

    expect(tagsViewMocks.addView).toHaveBeenCalled();
    expect(tagsViewMocks.route.meta.title).toBe('动态标题');
    expect(tagsViewMocks.moveToTarget).toHaveBeenCalled();
    expect(tagsViewMocks.addVisitedView).toHaveBeenCalledWith(
      expect.objectContaining({
        fullPath: '/system/inner'
      })
    );

    await wrapper.find('a[data-path="/a"]').trigger('mouseup', { button: 1 });
    await flushPromises();
    expect(tagsViewMocks.closePage).toHaveBeenCalledWith(expect.objectContaining({ path: '/a' }));

    await wrapper.find('a[data-path="/a"]').trigger('contextmenu', { clientX: 50, clientY: 100 });
    expect(wrapper.find('ul.contextmenu').attributes('style')).toContain('left: 55px');
    document.body.click();
    await flushPromises();

    expect(wrapper.find('ul.contextmenu').isVisible()).toBe(false);

    await wrapper.find('a[data-path="/a"]').trigger('contextmenu', { clientX: 50, clientY: 100 });
    await wrapper.find('button.emit-scroll').trigger('click');
    await flushPromises();
    expect(wrapper.find('ul.contextmenu').isVisible()).toBe(false);
  });

  it('covers close-all affix-return and empty-list root fallback branches', async () => {
    tagsViewMocks.route.path = '/index';
    tagsViewMocks.route.fullPath = '/index';
    tagsViewMocks.route.name = 'Index';
    tagsViewMocks.closeAllPage.mockResolvedValueOnce({
      visitedViews: []
    });

    const wrapper = mountView();
    Object.defineProperty((wrapper.vm as { $el: HTMLElement }).$el, 'offsetWidth', {
      configurable: true,
      value: 200
    });
    await flushPromises();

    await wrapper.find('a[data-path="/index"]').trigger('contextmenu', { clientX: 80, clientY: 90 });
    const closeAllItem = wrapper.findAll('ul.contextmenu li').find((item) => item.text().includes('全部关闭'));
    expect(closeAllItem).toBeDefined();
    await closeAllItem!.trigger('click');
    await flushPromises();

    expect(tagsViewMocks.routerPush).not.toHaveBeenCalled();
    expect(tagsViewMocks.routerReplace).not.toHaveBeenCalled();

    tagsViewMocks.route.path = '/other';
    tagsViewMocks.route.fullPath = '/other';
    tagsViewMocks.route.name = 'Other';
    tagsViewMocks.closeAllPage.mockResolvedValueOnce({
      visitedViews: []
    });
    await wrapper.find('a[data-path="/a"]').trigger('contextmenu', { clientX: 80, clientY: 90 });
    const closeAllItem2 = wrapper.findAll('ul.contextmenu li').find((item) => item.text().includes('全部关闭'));
    expect(closeAllItem2).toBeDefined();
    await closeAllItem2!.trigger('click');
    await flushPromises();

    expect(tagsViewMocks.routerPush).toHaveBeenCalledWith('/');
  });
});
