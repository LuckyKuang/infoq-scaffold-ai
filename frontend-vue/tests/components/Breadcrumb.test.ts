import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import Breadcrumb from '@/components/Breadcrumb/index.vue';

const breadcrumbMocks = vi.hoisted(() => ({
  route: {
    path: '/system/user',
    matched: [
      { path: '/system', meta: { title: '系统管理' }, name: 'System' },
      { path: '/system/user', meta: { title: '用户管理' }, name: 'User' }
    ]
  },
  routerPush: vi.fn(),
  permissionStore: {
    defaultRoutes: []
  }
}));

vi.mock('vue-router', () => ({
  useRoute: () => breadcrumbMocks.route,
  useRouter: () => ({
    push: breadcrumbMocks.routerPush
  })
}));

vi.mock('@/store/modules/permission', () => ({
  usePermissionStore: () => breadcrumbMocks.permissionStore
}));

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

describe('components/Breadcrumb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    breadcrumbMocks.route.path = '/system/user';
    breadcrumbMocks.route.matched = [
      { path: '/system', meta: { title: '系统管理' }, name: 'System' },
      { path: '/system/user', meta: { title: '用户管理' }, name: 'User' }
    ];
    breadcrumbMocks.permissionStore.defaultRoutes = [];
  });

  const mountView = () =>
    mount(Breadcrumb, {
      global: {
        stubs: {
          'el-breadcrumb': passthroughStub('ElBreadcrumb'),
          'el-breadcrumb-item': passthroughStub('ElBreadcrumbItem'),
          'transition-group': passthroughStub('TransitionGroup')
        }
      }
    });

  it('renders breadcrumb from matched routes and navigates by clicking link', async () => {
    const wrapper = mountView();

    expect(wrapper.text()).toContain('首页');
    expect(wrapper.text()).toContain('系统管理');
    expect(wrapper.text()).toContain('用户管理');

    const links = wrapper.findAll('a');
    expect(links.length).toBeGreaterThan(0);
    await links[0].trigger('click');
    expect(breadcrumbMocks.routerPush).toHaveBeenCalledWith('/index');
  });

  it('builds multi-level breadcrumb from permission routes', () => {
    breadcrumbMocks.route.path = '/system/user/authRole';
    breadcrumbMocks.route.matched = [];
    breadcrumbMocks.permissionStore.defaultRoutes = [
      {
        path: '/system',
        name: 'System',
        meta: { title: '系统管理' },
        children: [
          {
            path: 'user',
            name: 'User',
            meta: { title: '用户管理' },
            children: [
              {
                path: 'authRole',
                name: 'AuthRole',
                meta: { title: '分配角色' }
              }
            ]
          }
        ]
      }
    ];

    const wrapper = mountView();

    expect(wrapper.text()).toContain('首页');
    expect(wrapper.text()).toContain('系统管理');
    expect(wrapper.text()).toContain('用户管理');
    expect(wrapper.text()).toContain('分配角色');
  });

  it('treats unnamed first matched route as non-dashboard', () => {
    breadcrumbMocks.route.path = '/system/notice';
    breadcrumbMocks.route.matched = [
      { path: '/system', meta: { title: '系统管理' }, name: '' },
      { path: '/system/notice', meta: { title: '通知公告' }, name: 'Notice' }
    ];

    const wrapper = mountView();
    expect(wrapper.text()).toContain('首页');
    expect(wrapper.text()).toContain('通知公告');
  });
});
