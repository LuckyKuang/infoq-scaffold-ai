import { flushPromises, mount } from '@vue/test-utils';
import { ElMessageBox } from 'element-plus/es';
import { defineComponent, h, reactive } from 'vue';
import Navbar from '@/layout/components/Navbar.vue';

const navbarMocks = vi.hoisted(() => ({
  toggleSideBar: vi.fn(),
  logout: vi.fn(),
  closeAllPage: vi.fn(),
  routerReplace: vi.fn(),
  searchOpen: vi.fn(),
  appStore: {
    sidebar: {
      opened: true
    },
    device: 'desktop',
    toggleSideBar: vi.fn()
  },
  userStore: {
    avatar: 'https://cdn.example.com/avatar.png',
    logout: vi.fn()
  },
  settingsStore: {
    topNav: false,
    showSettings: true
  },
  noticeStore: {
    state: {
      notices: [] as Array<{ messageId: number; title: string; createTime: string; readTime: string | null }>,
      unreadCount: 0,
      loading: false
    },
    refresh: vi.fn(),
    readAll: vi.fn()
  },
  router: {
    replace: vi.fn(),
    currentRoute: {
      value: {
        fullPath: '/system/user?tab=1'
      }
    }
  }
}));

vi.mock('@/store/modules/app', () => ({
  useAppStore: () => navbarMocks.appStore
}));

vi.mock('@/store/modules/user', () => ({
  useUserStore: () => navbarMocks.userStore
}));

vi.mock('@/store/modules/settings', () => ({
  useSettingsStore: () => navbarMocks.settingsStore
}));

vi.mock('@/store/modules/notice', () => ({
  useNoticeStore: () => navbarMocks.noticeStore
}));

vi.mock('@/router', () => ({
  default: navbarMocks.router
}));

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', { class: `${name}-stub` }, slots.default?.());
    }
  });

const HamburgerStub = defineComponent({
  name: 'Hamburger',
  emits: ['toggle-click'],
  setup(_, { emit }) {
    return () =>
      h(
        'button',
        {
          class: 'hamburger-stub',
          onClick: () => emit('toggle-click')
        },
        'toggle'
      );
  }
});

const SearchMenuStub = defineComponent({
  name: 'SearchMenu',
  setup(_, { expose }) {
    expose({
      openSearch: navbarMocks.searchOpen
    });
    return () => h('div', { class: 'search-menu-stub' });
  }
});

const ElBadgeStub = defineComponent({
  name: 'ElBadge',
  props: {
    value: {
      type: [String, Number],
      default: ''
    }
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: 'el-badge-stub',
          'data-value': String(props.value)
        },
        slots.default?.()
      );
  }
});

const ElPopoverStub = defineComponent({
  name: 'ElPopover',
  setup(_, { slots }) {
    return () =>
      h('div', { class: 'el-popover-stub' }, [
        h('div', { class: 'popover-reference' }, slots.reference?.()),
        h('div', { class: 'popover-content' }, slots.default?.())
      ]);
  }
});

const ElDropdownStub = defineComponent({
  name: 'ElDropdown',
  emits: ['command'],
  setup(_, { slots, emit }) {
    return () =>
      h('div', { class: 'el-dropdown-stub' }, [
        h('button', { class: 'dropdown-layout', onClick: () => emit('command', 'setLayout') }, 'setLayout'),
        h('button', { class: 'dropdown-logout', onClick: () => emit('command', 'logout') }, 'logout'),
        slots.default?.(),
        slots.dropdown?.()
      ]);
  }
});

describe('layout/components/Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navbarMocks.appStore.toggleSideBar = navbarMocks.toggleSideBar;
    navbarMocks.userStore.logout = navbarMocks.logout;
    navbarMocks.noticeStore.state = reactive({
      notices: [],
      unreadCount: 0,
      loading: false
    });
    navbarMocks.noticeStore.refresh.mockResolvedValue(undefined);
    navbarMocks.router.replace = navbarMocks.routerReplace;
    navbarMocks.router.currentRoute.value.fullPath = '/system/user?tab=1';
    (ElMessageBox.confirm as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    navbarMocks.logout.mockResolvedValue(undefined);
  });

  const mountNavbar = () =>
    mount(Navbar, {
      global: {
        config: {
          globalProperties: {
            $t: (key: string) => key,
            $tab: {
              closeAllPage: navbarMocks.closeAllPage
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          hamburger: HamburgerStub,
          breadcrumb: true,
          'top-nav': true,
          'search-menu': SearchMenuStub,
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-popover': ElPopoverStub,
          'el-badge': ElBadgeStub,
          notice: true,
          'info-q-git': true,
          'screen-full': true,
          'lang-select': true,
          'size-select': true,
          'el-dropdown': ElDropdownStub,
          'el-dropdown-menu': passthroughStub('ElDropdownMenu'),
          'el-dropdown-item': passthroughStub('ElDropdownItem'),
          'router-link': passthroughStub('RouterLink'),
          'el-icon': passthroughStub('ElIcon'),
          'caret-bottom': true,
          'svg-icon': true
        }
      }
    });

  it('refreshes persisted messages on mount and handles sidebar, search and layout commands', async () => {
    const wrapper = mountNavbar();
    await flushPromises();

    expect(navbarMocks.noticeStore.refresh).toHaveBeenCalledTimes(1);

    await wrapper.find('button.hamburger-stub').trigger('click');
    expect(navbarMocks.toggleSideBar).toHaveBeenCalledWith(false);

    const hoverItems = wrapper.findAll('.right-menu-item.hover-effect');
    await hoverItems[0].trigger('click');
    expect(navbarMocks.searchOpen).toHaveBeenCalledTimes(1);

    await wrapper.find('button.dropdown-layout').trigger('click');
    expect(wrapper.emitted('setLayout')).toHaveLength(1);
  });

  it('updates unread badge and performs logout flow', async () => {
    const wrapper = mountNavbar();

    navbarMocks.noticeStore.state.unreadCount = 2;
    await flushPromises();

    expect(wrapper.find('.el-badge-stub').attributes('data-value')).toBe('2');

    await wrapper.find('button.dropdown-logout').trigger('click');
    await flushPromises();

    expect(ElMessageBox.confirm).toHaveBeenCalledTimes(1);
    expect(navbarMocks.logout).toHaveBeenCalledTimes(1);
    expect(navbarMocks.routerReplace).toHaveBeenCalledWith({
      path: '/login',
      query: {
        redirect: encodeURIComponent('/system/user?tab=1')
      }
    });
    expect(navbarMocks.closeAllPage).toHaveBeenCalledTimes(1);
  });
});
