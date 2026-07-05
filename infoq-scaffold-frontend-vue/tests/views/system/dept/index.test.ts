import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import DeptView from '@/views/system/dept/index.vue';

const deptMocks = vi.hoisted(() => ({
  listDept: vi.fn(),
  getDept: vi.fn(),
  delDept: vi.fn(),
  addDept: vi.fn(),
  updateDept: vi.fn(),
  listDeptExcludeChild: vi.fn(),
  listUserByDeptId: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  toggleRowExpansion: vi.fn(),
  deptTree: [
    {
      deptId: 1,
      deptName: '总部',
      deptCategory: 'head',
      orderNum: 1,
      status: '0',
      createTime: '2026-03-07 10:00:00',
      children: [
        {
          deptId: 2,
          deptName: '研发部',
          deptCategory: 'rd',
          orderNum: 2,
          status: '0',
          createTime: '2026-03-07 10:00:00',
          children: []
        }
      ]
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/system/dept', () => ({
  listDept: deptMocks.listDept,
  getDept: deptMocks.getDept,
  delDept: deptMocks.delDept,
  addDept: deptMocks.addDept,
  updateDept: deptMocks.updateDept,
  listDeptExcludeChild: deptMocks.listDeptExcludeChild
}));

vi.mock('@/api/system/user', () => ({
  listUserByDeptId: deptMocks.listUserByDeptId
}));

const TABLE_DATA_SYMBOL = Symbol('dept-table-data');

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
  setup(props, { slots, expose }) {
    provide(
      TABLE_DATA_SYMBOL,
      computed(() => props.data as unknown[])
    );
    expose({
      toggleRowExpansion: deptMocks.toggleRowExpansion
    });
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

describe('views/system/dept/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deptMocks.deptTree = [
      {
        deptId: 1,
        deptName: '总部',
        deptCategory: 'head',
        orderNum: 1,
        status: '0',
        createTime: '2026-03-07 10:00:00',
        children: [
          {
            deptId: 2,
            deptName: '研发部',
            deptCategory: 'rd',
            orderNum: 2,
            status: '0',
            createTime: '2026-03-07 10:00:00',
            children: []
          }
        ]
      }
    ];
    deptMocks.listDept.mockImplementation(() =>
      Promise.resolve({
        data: deptMocks.deptTree
      })
    );
    deptMocks.getDept.mockResolvedValue({
      data: {
        deptId: 1,
        parentId: 0,
        parentName: '根部门',
        deptName: '总部',
        deptCategory: 'head',
        orderNum: 1,
        leader: 10,
        status: '0',
        children: [],
        delFlag: '0',
        ancestors: '0',
        createTime: '2026-03-07 10:00:00'
      }
    });
    deptMocks.listDeptExcludeChild.mockResolvedValue({
      data: []
    });
    deptMocks.listUserByDeptId.mockResolvedValue({
      data: [{ userId: 10, userName: 'admin' }]
    });
    deptMocks.addDept.mockResolvedValue(undefined);
    deptMocks.updateDept.mockResolvedValue(undefined);
    deptMocks.delDept.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(DeptView, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_normal_disable: [
                  { label: '正常', value: '0' },
                  { label: '停用', value: '1' }
                ]
              }),
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            parseTime: (value: string) => value,
            handleTree: (data: unknown[]) => data,
            $modal: {
              confirm: deptMocks.modalConfirm,
              msgSuccess: deptMocks.msgSuccess
            }
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
          'el-tree-select': true,
          'el-input-number': true,
          'el-radio-group': passthroughStub('ElRadioGroup'),
          'el-radio': passthroughStub('ElRadio'),
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'dict-tag': true,
          'right-toolbar': true,
          'el-dialog': ElDialogStub,
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-button': ElButtonStub
        }
      }
    });

  it('loads department tree list on mount', async () => {
    mountView();
    await flushPromises();

    expect(deptMocks.listDept).toHaveBeenCalledTimes(1);
    expect(deptMocks.listDept).toHaveBeenCalledWith(expect.objectContaining({ pageNum: 1, pageSize: 10 }));
  });

  it('toggles tree expand/collapse recursively', async () => {
    const wrapper = mountView();
    await flushPromises();

    const toggleButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '展开/折叠');
    expect(toggleButton).toBeDefined();
    await toggleButton!.trigger('click');

    expect(deptMocks.toggleRowExpansion).toHaveBeenCalledWith(expect.objectContaining({ deptId: 1 }), false);
    expect(deptMocks.toggleRowExpansion).toHaveBeenCalledWith(expect.objectContaining({ deptId: 2 }), false);
  });

  it('adds new department', async () => {
    const wrapper = mountView();
    await flushPromises();

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    expect(deptMocks.listDept).toHaveBeenCalledTimes(2);

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(deptMocks.addDept).toHaveBeenCalledTimes(1);
    expect(deptMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('updates department from row action', async () => {
    const wrapper = mountView();
    await flushPromises();

    const editButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'Edit');
    expect(editButton).toBeDefined();
    await editButton!.trigger('click');
    await flushPromises();

    expect(deptMocks.getDept).toHaveBeenCalledWith(1);
    expect(deptMocks.listDeptExcludeChild).toHaveBeenCalledWith(1);
    expect(deptMocks.listUserByDeptId).toHaveBeenCalledWith(1);

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(deptMocks.updateDept).toHaveBeenCalledTimes(1);
    expect(deptMocks.updateDept).toHaveBeenCalledWith(
      expect.not.objectContaining({
        children: expect.anything(),
        delFlag: expect.anything(),
        ancestors: expect.anything(),
        createTime: expect.anything()
      })
    );
    expect(deptMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('deletes department from row action', async () => {
    const wrapper = mountView();
    await flushPromises();

    const deleteButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'Delete');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(deptMocks.modalConfirm).toHaveBeenCalledWith('是否确认删除名称为"总部"的数据项?');
    expect(deptMocks.delDept).toHaveBeenCalledWith(1);
    expect(deptMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('covers query/reset, add-child and cancel dialog branches', async () => {
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
    expect(deptMocks.listDept).toHaveBeenCalledTimes(3);

    const rowAddButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Plus' && button.text().trim() === '');
    expect(rowAddButton).toBeDefined();
    await rowAddButton!.trigger('click');
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      form: {
        parentId: number;
      };
    };
    expect(vm.form.parentId).toBe(1);

    const cancelButton = wrapper
      .find('.el-dialog-stub[data-title="添加部门"]')
      .findAll('button.el-button-stub')
      .find((button) => button.text().replace(/\s/g, '') === '取消');
    expect(cancelButton).toBeDefined();
    await cancelButton!.trigger('click');
    await flushPromises();
  });
});
