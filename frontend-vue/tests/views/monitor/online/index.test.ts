import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import OnlineView from '@/views/monitor/online/index.vue';

const onlineMocks = vi.hoisted(() => ({
  list: vi.fn(),
  forceLogout: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  rows: [
    {
      tokenId: 'token-1',
      userName: 'tester',
      clientKey: 'web',
      deviceType: 'pc',
      deptName: '研发部',
      ipaddr: '127.0.0.1',
      loginLocation: 'CN',
      os: 'macOS',
      browser: 'Chrome',
      loginTime: '2026-03-07 10:00:00'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/monitor/online', () => ({
  list: onlineMocks.list,
  forceLogout: onlineMocks.forceLogout
}));

const TABLE_DATA_SYMBOL = Symbol('online-table-data');

const ElCardStub = defineComponent({
  name: 'ElCard',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, [slots.header?.(), slots.default?.()]);
  }
});

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { slots, expose }) {
    expose({
      resetFields: vi.fn()
    });
    return () => h('form', { class: 'el-form-stub' }, slots.default?.());
  }
});

const ElTableStub = defineComponent({
  name: 'ElTable',
  props: {
    data: {
      type: Array,
      default: () => []
    }
  },
  setup(props, { slots }) {
    provide(
      TABLE_DATA_SYMBOL,
      computed(() => props.data as unknown[])
    );
    return () => h('div', { class: 'el-table-stub' }, slots.default?.());
  }
});

const ElTableColumnStub = defineComponent({
  name: 'ElTableColumn',
  setup(_, { slots }) {
    const rows = inject(
      TABLE_DATA_SYMBOL,
      computed(() => [] as unknown[])
    );
    return () =>
      h('div', { class: 'el-table-column-stub' }, (slots.default && slots.default({ row: rows.value[0] || { loginTime: '' }, $index: 0 })) || []);
  }
});

const ElButtonStub = defineComponent({
  name: 'ElButton',
  props: {
    icon: {
      type: String,
      default: ''
    }
  },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () =>
      h(
        'button',
        {
          class: 'el-button-stub',
          'data-icon': props.icon,
          onClick: (e: MouseEvent) => emit('click', e)
        },
        slots.default?.()
      );
  }
});

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

describe('views/monitor/online/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onlineMocks.rows = [
      {
        tokenId: 'token-1',
        userName: 'tester',
        clientKey: 'web',
        deviceType: 'pc',
        deptName: '研发部',
        ipaddr: '127.0.0.1',
        loginLocation: 'CN',
        os: 'macOS',
        browser: 'Chrome',
        loginTime: '2026-03-07 10:00:00'
      }
    ];
    onlineMocks.list.mockImplementation(() =>
      Promise.resolve({
        rows: onlineMocks.rows,
        total: onlineMocks.rows.length
      })
    );
    onlineMocks.forceLogout.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(OnlineView, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_device_type: [{ label: 'PC', value: 'pc' }]
              }),
            parseTime: (value: string) => value,
            $modal: {
              confirm: onlineMocks.modalConfirm,
              msgSuccess: onlineMocks.msgSuccess
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        directives: {
          loading: {},
          hasPermi: {}
        },
        stubs: {
          'el-card': ElCardStub,
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-input': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'dict-tag': true,
          pagination: true,
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-button': ElButtonStub
        }
      }
    });

  it('loads online list on mounted', async () => {
    mountView();
    await flushPromises();

    expect(onlineMocks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('searches with reset page number', async () => {
    const wrapper = mountView();
    await flushPromises();

    const searchButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '搜索');
    expect(searchButton).toBeDefined();
    await searchButton!.trigger('click');
    await flushPromises();

    expect(onlineMocks.list).toHaveBeenCalledTimes(2);
    expect(onlineMocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ pageNum: 1 }));
  });

  it('resets query and reloads list', async () => {
    const wrapper = mountView();
    await flushPromises();

    const resetButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '重置');
    expect(resetButton).toBeDefined();
    await resetButton!.trigger('click');
    await flushPromises();

    expect(onlineMocks.list).toHaveBeenCalledTimes(2);
    expect(onlineMocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ pageNum: 1 }));
  });

  it('forces logout by row action', async () => {
    const wrapper = mountView();
    await flushPromises();

    const logoutButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().trim() === '');
    expect(logoutButton).toBeDefined();
    await logoutButton!.trigger('click');
    await flushPromises();

    expect(onlineMocks.forceLogout).toHaveBeenCalledWith('token-1');
    expect(onlineMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });
});
