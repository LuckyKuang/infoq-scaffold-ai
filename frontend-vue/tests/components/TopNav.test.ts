import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import TopNav from '@/components/TopNav/index.vue';

const topNavMocks = vi.hoisted(() => ({
  route: {
    path: '/index',
    meta: {},
    children: undefined as unknown
  },
  routerPush: vi.fn(),
  toggleSideBarHide: vi.fn(),
  setSidebarRouters: vi.fn(),
  topbarRoutes: [] as Array<Record<string, unknown>>
}));

vi.mock('vue-router', () => ({
  useRoute: () => topNavMocks.route,
  useRouter: () => ({
    push: topNavMocks.routerPush
  })
}));

vi.mock('@/router', () => ({
  constantRoutes: [
    {
      path: '/single',
      query: '{"tab":"a"}'
    },
    {
      path: '/plain'
    }
  ]
}));

vi.mock('@/store/modules/app', () => ({
  useAppStore: () => ({
    toggleSideBarHide: topNavMocks.toggleSideBarHide
  })
}));

vi.mock('@/store/modules/settings', () => ({
  useSettingsStore: () => ({
    theme: '#409eff'
  })
}));

vi.mock('@/store/modules/permission', () => ({
  usePermissionStore: () => ({
    getTopbarRoutes: () => topNavMocks.topbarRoutes,
    setSidebarRouters: topNavMocks.setSidebarRouters
  })
}));

const createTopbarRoutes = () => [
  {
    path: '/system',
    hidden: false,
    meta: {
      title: '系统管理',
      icon: 'system'
    },
    children: [
      {
        path: 'user',
        meta: {
          title: '用户管理',
          icon: 'user'
        }
      }
    ]
  },
  {
    path: 'https://docs.example.com',
    hidden: false,
    meta: {
      title: '外链文档',
      icon: 'link'
    }
  },
  {
    path: '/single',
    hidden: false,
    meta: {
      title: '单页菜单',
      icon: 'form'
    }
  },
  {
    path: '/plain',
    hidden: false,
    meta: {
      title: '普通菜单',
      icon: 'menu'
    }
  },
  {
    path: '/',
    hidden: false,
    children: [
      {
        path: '/welcome',
        meta: {
          title: '首页',
          icon: 'dashboard'
        }
      }
    ]
  }
];

const ElMenuStub = defineComponent({
  name: 'ElMenu',
  props: {
    defaultActive: {
      type: String,
      default: ''
    }
  },
  emits: ['select'],
  setup(props, { slots, emit }) {
    return () =>
      h('div', { class: 'el-menu-stub', 'data-default-active': props.defaultActive }, [
        h(
          'button',
          {
            class: 'select-http',
            onClick: () => emit('select', 'https://docs.example.com')
          },
          'select-http'
        ),
        h(
          'button',
          {
            class: 'select-single',
            onClick: () => emit('select', '/single')
          },
          'select-single'
        ),
        h(
          'button',
          {
            class: 'select-system',
            onClick: () => emit('select', '/system')
          },
          'select-system'
        ),
        h(
          'button',
          {
            class: 'select-plain',
            onClick: () => emit('select', '/plain')
          },
          'select-plain'
        ),
        slots.default?.()
      ]);
  }
});

const ElMenuItemStub = defineComponent({
  name: 'ElMenuItem',
  props: {
    index: {
      type: String,
      default: ''
    }
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'el-menu-item-stub', 'data-index': props.index }, slots.default?.());
  }
});

const ElSubMenuStub = defineComponent({
  name: 'ElSubMenu',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-sub-menu-stub' }, [h('div', { class: 'title' }, slots.title?.()), h('div', slots.default?.())]);
  }
});

describe('components/TopNav', () => {
  let rectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    topNavMocks.route.path = '/index';
    topNavMocks.route.meta = {};
    topNavMocks.route.children = undefined;
    topNavMocks.topbarRoutes = createTopbarRoutes();
    rectSpy = vi.spyOn(document.body, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      toJSON: () => ({})
    } as DOMRect);
  });

  afterEach(() => {
    rectSpy.mockRestore();
  });

  const mountTopNav = () =>
    mount(TopNav, {
      global: {
        stubs: {
          'el-menu': ElMenuStub,
          'el-menu-item': ElMenuItemStub,
          'el-sub-menu': ElSubMenuStub,
          'svg-icon': true
        }
      }
    });

  it('computes active menu and initializes sidebar routes on index path', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const wrapper = mountTopNav();

    expect(wrapper.find('.el-menu-stub').attributes('data-default-active')).toBe('/system');
    expect(topNavMocks.setSidebarRouters).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ path: '/system/user', parentPath: '/system' })])
    );
    expect(topNavMocks.toggleSideBarHide).toHaveBeenCalledWith(false);
    expect(wrapper.text()).toContain('首页');

    wrapper.unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it('handles external, single-page and linked sidebar menu selection', async () => {
    topNavMocks.route.path = '/dashboard';
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const wrapper = mountTopNav();

    await wrapper.find('button.select-http').trigger('click');
    expect(openSpy).toHaveBeenCalledWith('https://docs.example.com', '_blank');

    await wrapper.find('button.select-single').trigger('click');
    expect(topNavMocks.routerPush).toHaveBeenCalledWith({
      path: '/single',
      query: {
        tab: 'a'
      }
    });
    expect(topNavMocks.toggleSideBarHide).toHaveBeenCalledWith(true);

    await wrapper.find('button.select-plain').trigger('click');
    expect(topNavMocks.routerPush).toHaveBeenCalledWith({
      path: '/plain'
    });

    await wrapper.find('button.select-system').trigger('click');
    expect(topNavMocks.setSidebarRouters).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ parentPath: '/system' })]));
    expect(topNavMocks.toggleSideBarHide).toHaveBeenCalledWith(false);

    openSpy.mockRestore();
  });
});
