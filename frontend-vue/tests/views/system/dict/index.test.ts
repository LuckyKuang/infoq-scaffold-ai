import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide } from 'vue';
import DictTypeView from '@/views/system/dict/index.vue';

const dictTypeMocks = vi.hoisted(() => ({
  listType: vi.fn(),
  getType: vi.fn(),
  delType: vi.fn(),
  addType: vi.fn(),
  updateType: vi.fn(),
  refreshCache: vi.fn(),
  cleanDict: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  download: vi.fn(),
  rows: [
    {
      dictId: 1,
      dictName: '状态',
      dictType: 'sys_status',
      remark: '状态字典',
      createTime: '2026-03-07 10:00:00'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/system/dict/type', () => ({
  listType: dictTypeMocks.listType,
  getType: dictTypeMocks.getType,
  delType: dictTypeMocks.delType,
  addType: dictTypeMocks.addType,
  updateType: dictTypeMocks.updateType,
  refreshCache: dictTypeMocks.refreshCache
}));

vi.mock('@/store/modules/dict', () => ({
  useDictStore: () => ({
    cleanDict: dictTypeMocks.cleanDict
  })
}));

const TABLE_DATA_SYMBOL = Symbol('dict-type-table-data');

const ElCardStub = defineComponent({
  name: 'ElCard',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, [slots.header?.(), slots.default?.()]);
  }
});

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  setup(props, { slots }) {
    return () =>
      props.modelValue ? h('div', { class: 'el-dialog-stub', 'data-title': props.title }, [slots.default?.(), slots.footer?.()]) : h('div');
  }
});

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { slots, expose }) {
    expose({
      resetFields: vi.fn(),
      validate: (cb: (valid: boolean) => void) => cb(true)
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
  emits: ['selection-change'],
  setup(props, { slots, emit }) {
    provide(
      TABLE_DATA_SYMBOL,
      computed(() => props.data as unknown[])
    );
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
      h('div', { class: 'el-table-column-stub' }, (slots.default && slots.default({ row: rows.value[0] || { createTime: '' }, $index: 0 })) || []);
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

describe('views/system/dict/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dictTypeMocks.rows = [
      {
        dictId: 1,
        dictName: '状态',
        dictType: 'sys_status',
        remark: '状态字典',
        createTime: '2026-03-07 10:00:00'
      }
    ];
    dictTypeMocks.listType.mockImplementation(() =>
      Promise.resolve({
        rows: dictTypeMocks.rows,
        total: dictTypeMocks.rows.length
      })
    );
    dictTypeMocks.getType.mockResolvedValue({
      data: {
        dictId: 1,
        dictName: '状态',
        dictType: 'sys_status',
        remark: '状态字典',
        createTime: '2026-03-07 10:00:00',
        createByName: 'admin'
      }
    });
    dictTypeMocks.addType.mockResolvedValue(undefined);
    dictTypeMocks.updateType.mockResolvedValue(undefined);
    dictTypeMocks.delType.mockResolvedValue(undefined);
    dictTypeMocks.refreshCache.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(DictTypeView, {
      global: {
        config: {
          globalProperties: {
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            addDateRange: (query: Record<string, unknown>, range: string[]) => ({ ...query, range }),
            parseTime: (value: string) => value,
            $modal: {
              confirm: dictTypeMocks.modalConfirm,
              msgSuccess: dictTypeMocks.msgSuccess
            },
            download: dictTypeMocks.download
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        directives: {
          loading: {},
          hasPermi: {}
        },
        stubs: {
          transition: passthroughStub('Transition'),
          'el-card': ElCardStub,
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-input': true,
          'el-date-picker': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'router-link': true,
          pagination: true,
          'right-toolbar': true,
          'el-dialog': ElDialogStub,
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-button': ElButtonStub
        }
      }
    });

  it('loads dict type list on mount', async () => {
    mountView();
    await flushPromises();

    expect(dictTypeMocks.listType).toHaveBeenCalledTimes(1);
    expect(dictTypeMocks.listType).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('adds new dict type through dialog submit', async () => {
    const wrapper = mountView();
    await flushPromises();

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(dictTypeMocks.addType).toHaveBeenCalledTimes(1);
    expect(dictTypeMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('updates selected dict type', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const headerEdit = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '修改');
    expect(headerEdit).toBeDefined();
    await headerEdit!.trigger('click');
    await flushPromises();

    expect(dictTypeMocks.getType).toHaveBeenCalledWith(1);

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(dictTypeMocks.updateType).toHaveBeenCalledTimes(1);
    expect(dictTypeMocks.updateType).toHaveBeenCalledWith(
      expect.not.objectContaining({
        createTime: expect.anything(),
        createByName: expect.anything()
      })
    );
    expect(dictTypeMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('deletes selected dict type and refreshes cache', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const deleteButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '删除');
    const refreshButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '刷新缓存');
    expect(deleteButton).toBeDefined();
    expect(refreshButton).toBeDefined();

    await deleteButton!.trigger('click');
    await flushPromises();

    expect(dictTypeMocks.modalConfirm).toHaveBeenCalledWith('是否确认删除字典编号为"1"的数据项？');
    expect(dictTypeMocks.delType).toHaveBeenCalledWith([1]);
    expect(dictTypeMocks.msgSuccess).toHaveBeenCalledWith('删除成功');

    await refreshButton!.trigger('click');
    await flushPromises();

    expect(dictTypeMocks.refreshCache).toHaveBeenCalledTimes(1);
    expect(dictTypeMocks.cleanDict).toHaveBeenCalledTimes(1);
    expect(dictTypeMocks.msgSuccess).toHaveBeenCalledWith('刷新成功');
  });

  it('exports dict type list', async () => {
    const wrapper = mountView();
    await flushPromises();

    const exportButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '导出');
    expect(exportButton).toBeDefined();

    await exportButton!.trigger('click');
    expect(dictTypeMocks.download).toHaveBeenCalledTimes(1);
    expect(dictTypeMocks.download).toHaveBeenCalledWith(
      'system/dict/type/export',
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      }),
      expect.stringMatching(/^dict_\d+\.xlsx$/)
    );
  });

  it('covers query/reset and cancel dialog branches', async () => {
    const wrapper = mountView();
    await flushPromises();

    const searchButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '搜索');
    const resetButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '重置');
    expect(searchButton).toBeDefined();
    expect(resetButton).toBeDefined();

    await searchButton!.trigger('click');
    await flushPromises();
    await resetButton!.trigger('click');
    await flushPromises();
    expect(dictTypeMocks.listType).toHaveBeenCalledTimes(3);

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    const cancelButton = wrapper
      .find('.el-dialog-stub[data-title="添加字典类型"]')
      .findAll('button.el-button-stub')
      .find((button) => button.text().replace(/\s/g, '') === '取消');
    expect(cancelButton).toBeDefined();
    await cancelButton!.trigger('click');
    await flushPromises();
  });
});
