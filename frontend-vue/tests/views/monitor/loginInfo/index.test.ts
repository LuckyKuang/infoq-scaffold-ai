import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import LoginInfoView from '@/views/monitor/loginInfo/index.vue';

const loginInfoMocks = vi.hoisted(() => ({
  list: vi.fn(),
  delLoginInfo: vi.fn(),
  cleanLoginInfo: vi.fn(),
  unlockLoginInfo: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  download: vi.fn(),
  tableSort: vi.fn(),
  formResetFields: vi.fn(),
  rows: [
    {
      infoId: 1,
      userName: 'tester',
      clientKey: 'web',
      deviceType: 'pc',
      ipaddr: '127.0.0.1',
      loginLocation: 'CN',
      os: 'macOS',
      browser: 'Chrome',
      status: '0',
      msg: 'ok',
      loginTime: '2026-03-07 10:00:00'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/monitor/loginInfo', () => ({
  list: loginInfoMocks.list,
  delLoginInfo: loginInfoMocks.delLoginInfo,
  cleanLoginInfo: loginInfoMocks.cleanLoginInfo,
  unlockLoginInfo: loginInfoMocks.unlockLoginInfo
}));

const TABLE_DATA_SYMBOL = Symbol('login-info-table-data');

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
      resetFields: loginInfoMocks.formResetFields
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
  emits: ['selection-change', 'sort-change'],
  setup(props, { slots, emit, expose }) {
    provide(
      TABLE_DATA_SYMBOL,
      computed(() => props.data as unknown[])
    );
    expose({
      sort: loginInfoMocks.tableSort
    });
    return () =>
      h('div', { class: 'el-table-stub' }, [
        h(
          'button',
          {
            class: 'selection-first',
            onClick: () => emit('selection-change', [(props.data as unknown[])[0]])
          },
          'selection-first'
        ),
        h(
          'button',
          {
            class: 'sort-user-name',
            onClick: () => emit('sort-change', { prop: 'userName', order: 'ascending' })
          },
          'sort-user-name'
        ),
        slots.default?.()
      ]);
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

describe('views/monitor/loginInfo/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginInfoMocks.rows = [
      {
        infoId: 1,
        userName: 'tester',
        clientKey: 'web',
        deviceType: 'pc',
        ipaddr: '127.0.0.1',
        loginLocation: 'CN',
        os: 'macOS',
        browser: 'Chrome',
        status: '0',
        msg: 'ok',
        loginTime: '2026-03-07 10:00:00'
      }
    ];
    loginInfoMocks.list.mockImplementation(() =>
      Promise.resolve({
        rows: loginInfoMocks.rows,
        total: loginInfoMocks.rows.length
      })
    );
    loginInfoMocks.delLoginInfo.mockResolvedValue(undefined);
    loginInfoMocks.cleanLoginInfo.mockResolvedValue(undefined);
    loginInfoMocks.unlockLoginInfo.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(LoginInfoView, {
      global: {
        config: {
          globalProperties: {
            useDict: (...names: string[]) => {
              const result: Record<string, unknown> = {};
              if (names.includes('sys_device_type')) {
                result.sys_device_type = [{ label: 'PC', value: 'pc' }];
              }
              if (names.includes('sys_common_status')) {
                result.sys_common_status = [{ label: '成功', value: '0' }];
              }
              return reactive(result);
            },
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            addDateRange: (query: Record<string, unknown>, range: unknown[]) => ({ ...query, range }),
            parseTime: (value: string) => value,
            $modal: {
              confirm: loginInfoMocks.modalConfirm,
              msgSuccess: loginInfoMocks.msgSuccess
            },
            download: loginInfoMocks.download
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        directives: {
          loading: {},
          hasPermi: {}
        },
        stubs: {
          transition: passthroughStub('Transition'),
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-card': ElCardStub,
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-input': true,
          'el-select': passthroughStub('ElSelect'),
          'el-option': passthroughStub('ElOption'),
          'el-date-picker': true,
          'right-toolbar': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'dict-tag': true,
          pagination: true,
          'el-button': ElButtonStub
        }
      }
    });

  it('loads login info list on mounted', async () => {
    mountView();
    await flushPromises();

    expect(loginInfoMocks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10,
        orderByColumn: 'loginTime',
        isAsc: 'descending'
      })
    );
  });

  it('deletes selected login info', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().replace(/\s/g, '') === '删除');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(loginInfoMocks.delLoginInfo).toHaveBeenCalledWith([1]);
    expect(loginInfoMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('cleans all login info', async () => {
    const wrapper = mountView();
    await flushPromises();

    const cleanButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '清空');
    expect(cleanButton).toBeDefined();
    await cleanButton!.trigger('click');
    await flushPromises();

    expect(loginInfoMocks.cleanLoginInfo).toHaveBeenCalledTimes(1);
    expect(loginInfoMocks.msgSuccess).toHaveBeenCalledWith('清空成功');
  });

  it('unlocks selected user', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const unlockButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '解锁');
    expect(unlockButton).toBeDefined();
    await unlockButton!.trigger('click');
    await flushPromises();

    expect(loginInfoMocks.unlockLoginInfo).toHaveBeenCalledWith(['tester']);
    expect(loginInfoMocks.msgSuccess).toHaveBeenCalledWith('用户tester解锁成功');
  });

  it('sorts and exports login info', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.sort-user-name').trigger('click');
    await flushPromises();

    expect(loginInfoMocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderByColumn: 'userName',
        isAsc: 'ascending'
      })
    );

    const exportButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '导出');
    expect(exportButton).toBeDefined();
    await exportButton!.trigger('click');

    expect(loginInfoMocks.download).toHaveBeenCalledWith(
      'monitor/loginInfo/export',
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      }),
      expect.stringMatching(/^loginInfo_\d+\.xlsx$/)
    );
  });

  it('supports query and reset actions', async () => {
    const wrapper = mountView();
    await flushPromises();

    const searchButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '搜索');
    const resetButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '重置');
    expect(searchButton).toBeDefined();
    expect(resetButton).toBeDefined();

    await searchButton!.trigger('click');
    await flushPromises();
    expect(loginInfoMocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageNum: 1
      })
    );

    await resetButton!.trigger('click');
    expect(loginInfoMocks.formResetFields).toHaveBeenCalledTimes(1);
    expect(loginInfoMocks.tableSort).toHaveBeenCalledWith('loginTime', 'descending');
  });
});
