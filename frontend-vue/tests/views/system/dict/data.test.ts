import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide } from 'vue';
import DictDataView from '@/views/system/dict/data.vue';

const dictDataMocks = vi.hoisted(() => ({
  route: {
    params: {
      dictId: '1'
    }
  },
  getType: vi.fn(),
  getDictOptionselect: vi.fn(),
  listData: vi.fn(),
  getData: vi.fn(),
  delData: vi.fn(),
  addData: vi.fn(),
  updateData: vi.fn(),
  removeDict: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  closeOpenPage: vi.fn(),
  download: vi.fn(),
  rows: [
    {
      dictCode: '11',
      dictLabel: '启用',
      dictValue: '0',
      listClass: 'primary',
      cssClass: '',
      dictSort: 1,
      createTime: '2026-03-07 10:00:00'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('vue-router', () => ({
  useRoute: () => dictDataMocks.route
}));

vi.mock('@/api/system/dict/type', () => ({
  optionselect: dictDataMocks.getDictOptionselect,
  getType: dictDataMocks.getType
}));

vi.mock('@/api/system/dict/data', () => ({
  listData: dictDataMocks.listData,
  getData: dictDataMocks.getData,
  delData: dictDataMocks.delData,
  addData: dictDataMocks.addData,
  updateData: dictDataMocks.updateData
}));

vi.mock('@/store/modules/dict', () => ({
  useDictStore: () => ({
    removeDict: dictDataMocks.removeDict
  })
}));

const TABLE_DATA_SYMBOL = Symbol('dict-data-table-data');

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

describe('views/system/dict/data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dictDataMocks.route.params.dictId = '1';
    dictDataMocks.rows = [
      {
        dictCode: '11',
        dictLabel: '启用',
        dictValue: '0',
        listClass: 'primary',
        cssClass: '',
        dictSort: 1,
        createTime: '2026-03-07 10:00:00'
      }
    ];
    dictDataMocks.getType.mockResolvedValue({
      data: {
        dictType: 'sys_status'
      }
    });
    dictDataMocks.getDictOptionselect.mockResolvedValue({
      data: [{ dictId: 1, dictName: '状态', dictType: 'sys_status' }]
    });
    dictDataMocks.listData.mockImplementation(() =>
      Promise.resolve({
        rows: dictDataMocks.rows,
        total: dictDataMocks.rows.length
      })
    );
    dictDataMocks.getData.mockResolvedValue({
      data: {
        dictCode: '11',
        dictType: 'sys_status',
        dictLabel: '启用',
        dictValue: '0',
        listClass: 'primary',
        cssClass: '',
        dictSort: 1,
        createTime: '2026-03-07 10:00:00',
        createByName: 'admin'
      }
    });
    dictDataMocks.addData.mockResolvedValue(undefined);
    dictDataMocks.updateData.mockResolvedValue(undefined);
    dictDataMocks.delData.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(DictDataView, {
      global: {
        config: {
          globalProperties: {
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            parseTime: (value: string) => value,
            $modal: {
              confirm: dictDataMocks.modalConfirm,
              msgSuccess: dictDataMocks.msgSuccess
            },
            $tab: {
              closeOpenPage: dictDataMocks.closeOpenPage
            },
            download: dictDataMocks.download
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
          'el-select': passthroughStub('ElSelect'),
          'el-option': passthroughStub('ElOption'),
          'el-input': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'el-tag': passthroughStub('ElTag'),
          pagination: true,
          'right-toolbar': true,
          'el-dialog': ElDialogStub,
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-input-number': true,
          'el-button': ElButtonStub
        }
      }
    });

  it('loads dict type details and data list on mounted', async () => {
    mountView();
    await flushPromises();

    expect(dictDataMocks.getType).toHaveBeenCalledWith('1');
    expect(dictDataMocks.getDictOptionselect).toHaveBeenCalledTimes(1);
    expect(dictDataMocks.listData).toHaveBeenCalledWith(
      expect.objectContaining({
        dictType: 'sys_status',
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('adds new dict data', async () => {
    const wrapper = mountView();
    await flushPromises();

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(dictDataMocks.addData).toHaveBeenCalledTimes(1);
    expect(dictDataMocks.removeDict).toHaveBeenCalledWith('sys_status');
    expect(dictDataMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('updates selected dict data', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const editButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '修改');
    expect(editButton).toBeDefined();
    await editButton!.trigger('click');
    await flushPromises();

    expect(dictDataMocks.getData).toHaveBeenCalledWith('11');

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(dictDataMocks.updateData).toHaveBeenCalledTimes(1);
    expect(dictDataMocks.updateData).toHaveBeenCalledWith(
      expect.not.objectContaining({
        createTime: expect.anything(),
        createByName: expect.anything()
      })
    );
    expect(dictDataMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('deletes selected dict data and refreshes dict cache item', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const deleteButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '删除');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(dictDataMocks.modalConfirm).toHaveBeenCalledWith('是否确认删除字典编码为"11"的数据项？');
    expect(dictDataMocks.delData).toHaveBeenCalledWith(['11']);
    expect(dictDataMocks.removeDict).toHaveBeenCalledWith('sys_status');
    expect(dictDataMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('exports data and supports closing page', async () => {
    const wrapper = mountView();
    await flushPromises();

    const exportButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '导出');
    const closeButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '关闭');
    expect(exportButton).toBeDefined();
    expect(closeButton).toBeDefined();

    await exportButton!.trigger('click');
    expect(dictDataMocks.download).toHaveBeenCalledWith(
      'system/dict/data/export',
      expect.objectContaining({
        dictType: 'sys_status'
      }),
      expect.stringMatching(/^dict_data_\d+\.xlsx$/)
    );

    await closeButton!.trigger('click');
    expect(dictDataMocks.closeOpenPage).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/system/dict'
      })
    );
  });

  it('covers plain-label render, query/reset and cancel branches', async () => {
    dictDataMocks.rows = [
      {
        dictCode: '22',
        dictLabel: '禁用',
        dictValue: '1',
        listClass: '',
        cssClass: '',
        dictSort: 2,
        createTime: '2026-03-07 10:00:00'
      }
    ];
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('禁用');

    const searchButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '搜索');
    const resetButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '重置');
    expect(searchButton).toBeDefined();
    expect(resetButton).toBeDefined();

    await searchButton!.trigger('click');
    await flushPromises();
    await resetButton!.trigger('click');
    await flushPromises();
    expect(dictDataMocks.listData).toHaveBeenCalledTimes(3);

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    const cancelButton = wrapper
      .find('.el-dialog-stub[data-title="添加字典数据"]')
      .findAll('button.el-button-stub')
      .find((button) => button.text().replace(/\s/g, '') === '取消');
    expect(cancelButton).toBeDefined();
    await cancelButton!.trigger('click');
    await flushPromises();
  });
});
