import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import NoticePanel from '@/layout/components/notice/index.vue';

const noticePanelMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  markRead: vi.fn(),
  readAll: vi.fn(),
  store: {
    state: {
      notices: [] as Array<{ messageId: number; title: string; createTime: string; readTime: string | null }>,
      unreadCount: 0,
      loading: false
    },
    refresh: vi.fn(),
    markRead: vi.fn(),
    readAll: vi.fn()
  }
}));

vi.mock('@/store/modules/notice', () => ({
  useNoticeStore: () => noticePanelMocks.store
}));

const ElEmptyStub = defineComponent({
  name: 'ElEmpty',
  props: {
    description: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    return () => h('div', { class: 'el-empty-stub' }, props.description);
  }
});

const ElButtonStub = defineComponent({
  name: 'ElButton',
  setup(_, { slots }) {
    return () => h('button', slots.default?.());
  }
});

const loadingDirective = {
  mounted(el: HTMLElement, binding: { value: boolean }) {
    el.setAttribute('data-loading', String(binding.value));
  },
  updated(el: HTMLElement, binding: { value: boolean }) {
    el.setAttribute('data-loading', String(binding.value));
  }
};

describe('layout/components/notice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    noticePanelMocks.store.state = reactive({
      notices: [],
      unreadCount: 0,
      loading: false
    });
    noticePanelMocks.store.refresh = noticePanelMocks.refresh;
    noticePanelMocks.store.markRead = noticePanelMocks.markRead;
    noticePanelMocks.store.readAll = noticePanelMocks.readAll;
    noticePanelMocks.refresh.mockResolvedValue(undefined);
    noticePanelMocks.markRead.mockResolvedValue(undefined);
    noticePanelMocks.readAll.mockResolvedValue(undefined);
  });

  const mountPanel = () =>
    mount(NoticePanel, {
      global: {
        directives: {
          loading: loadingDirective
        },
        stubs: {
          'el-empty': ElEmptyStub,
          'el-button': ElButtonStub
        }
      }
    });

  it('renders empty state when no notice exists', async () => {
    const wrapper = mountPanel();
    await flushPromises();

    expect(noticePanelMocks.refresh).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.el-empty-stub').text()).toBe('消息为空');
  });

  it('marks notice as read on click and forwards readAll action', async () => {
    noticePanelMocks.store.state.notices = [
      {
        messageId: 101,
        title: '待办消息',
        createTime: '2026-03-08 22:00:00',
        readTime: null
      },
      {
        messageId: 102,
        title: '已读消息',
        createTime: '2026-03-08 22:01:00',
        readTime: '2026-03-08 22:02:00'
      }
    ];

    const wrapper = mountPanel();
    await flushPromises();

    const items = wrapper.findAll('.content-box-item');
    expect(items).toHaveLength(2);
    expect(wrapper.text()).toContain('未读');

    await items[0].trigger('click');
    expect(noticePanelMocks.markRead).toHaveBeenCalledWith(101);

    await wrapper.find('.head-box-btn').trigger('click');
    expect(noticePanelMocks.readAll).toHaveBeenCalledTimes(1);
  });
});
