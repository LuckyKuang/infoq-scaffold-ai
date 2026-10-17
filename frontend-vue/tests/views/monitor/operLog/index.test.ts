import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import OperLogView from '@/views/monitor/operLog/index.vue';

const operLogMocks = vi.hoisted(() => ({
  list: vi.fn(),
  delOperLog: vi.fn(),
  cleanOperLog: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  download: vi.fn(),
  tableSort: vi.fn(),
  formResetFields: vi.fn(),
  openDialog: vi.fn(),
  rows: [
    {
      operId: 1,
      title: '用户管理',
      businessType: '1',
      operName: 'tester',
      deptName: '研发部',
      operIp: '127.0.0.1',
      status: '0',
      operTime: '2026-03-07 10:00:00',
      costTime: 12
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/monitor/operLog', () => ({
  list: operLogMocks.list,
  delOperLog: operLogMocks.delOperLog,
  cleanOperLog: operLogMocks.cleanOperLog
}));

vi.mock('@/views/monitor/operLog/oper-info-dialog.vue', () => ({
  default: defineComponent({
    name: 'OperInfoDialog',
    setup(_, { expose }) {
      expose({
        openDialog: operLogMocks.openDialog
      });
      return () => h('div', { class: 'oper-info-dialog-stub' });
    }
  })
}));

const TABLE_DATA_SYMBOL = Symbol('oper-log-table-data');

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
      resetFields: operLogMocks.formResetFields
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
      sort: operLogMocks.tableSort
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
            class: 'sort-oper-name',
            onClick: () => emit('sort-change', { prop: 'operName', order: 'ascending' })
          },
          'sort-oper-name'
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
      h('div', { class: 'el-table-column-stub' }, (slots.default && slots.default({ row: rows.value[0] || { operTime: '' }, $index: 0 })) || []);
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

describe('views/monitor/operLog/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operLogMocks.rows = [
      {
        operId: 1,
        title: '用户管理',
        businessType: '1',
        operName: 'tester',
        deptName: '研发部',
        operIp: '127.0.0.1',
        status: '0',
        operTime: '2026-03-07 10:00:00',
        costTime: 12
      }
    ];
    operLogMocks.list.mockImplementation(() =>
      Promise.resolve({
        rows: operLogMocks.rows,
        total: operLogMocks.rows.length
      })
    );
    operLogMocks.delOperLog.mockResolvedValue(undefined);
    operLogMocks.cleanOperLog.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(OperLogView, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_oper_type: [{ label: '新增', value: '1' }],
                sys_common_status: [{ label: '成功', value: '0' }]
              }),
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            addDateRange: (query: Record<string, unknown>, range: unknown[]) => ({ ...query, range }),
            parseTime: (value: string) => value,
            selectDictLabel: (options: Array<{ label: string; value: string }>, value: string) =>
              options.find((item) => item.value === value)?.label ?? '',
            $modal: {
              confirm: operLogMocks.modalConfirm,
              msgSuccess: operLogMocks.msgSuccess
            },
            download: operLogMocks.download
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
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-button': ElButtonStub
        }
      }
    });

  it('loads oper log list on mounted', async () => {
    mountView();
    await flushPromises();

    expect(operLogMocks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10,
        orderByColumn: 'operTime',
        isAsc: 'descending'
      })
    );
  });

  it('opens detail dialog by row action', async () => {
    const wrapper = mountView();
    await flushPromises();

    const viewButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'View');
    expect(viewButton).toBeDefined();
    await viewButton!.trigger('click');

    expect(operLogMocks.openDialog).toHaveBeenCalledWith(expect.objectContaining({ operId: 1 }));
  });

  it('deletes selected oper log', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');
    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().replace(/\s/g, '') === '删除');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(operLogMocks.delOperLog).toHaveBeenCalledWith([1]);
    expect(operLogMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('cleans oper logs', async () => {
    const wrapper = mountView();
    await flushPromises();

    const cleanButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '清空');
    expect(cleanButton).toBeDefined();
    await cleanButton!.trigger('click');
    await flushPromises();

    expect(operLogMocks.cleanOperLog).toHaveBeenCalledTimes(1);
    expect(operLogMocks.msgSuccess).toHaveBeenCalledWith('清空成功');
  });

  it('sorts and exports oper logs', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.sort-oper-name').trigger('click');
    await flushPromises();
    expect(operLogMocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderByColumn: 'operName',
        isAsc: 'ascending'
      })
    );

    const exportButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '导出');
    expect(exportButton).toBeDefined();
    await exportButton!.trigger('click');

    expect(operLogMocks.download).toHaveBeenCalledWith(
      'monitor/operLog/export',
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      }),
      expect.stringMatching(/^config_\d+\.xlsx$/)
    );
  });

  it('supports query/reset actions and type formatter', async () => {
    const wrapper = mountView();
    await flushPromises();

    const searchButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '搜索');
    const resetButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '重置');
    expect(searchButton).toBeDefined();
    expect(resetButton).toBeDefined();

    await searchButton!.trigger('click');
    await flushPromises();
    expect(operLogMocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageNum: 1
      })
    );

    await resetButton!.trigger('click');
    expect(operLogMocks.formResetFields).toHaveBeenCalledTimes(1);
    expect(operLogMocks.tableSort).toHaveBeenCalledWith('operTime', 'descending');

    const vm = wrapper.vm as unknown as {
      typeFormat: (row: { businessType: string }) => string;
    };
    const formatted = vm.typeFormat({ businessType: '1' });
    expect(formatted).toBe('新增');
  });
});
