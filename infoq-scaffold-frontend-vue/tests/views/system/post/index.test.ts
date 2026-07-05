import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import PostView from '@/views/system/post/index.vue';

const postMocks = vi.hoisted(() => ({
  listPost: vi.fn(),
  addPost: vi.fn(),
  delPost: vi.fn(),
  getPost: vi.fn(),
  updatePost: vi.fn(),
  deptTreeSelect: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  download: vi.fn(),
  rows: [
    {
      postId: 1,
      deptId: 100,
      postCode: 'dev-001',
      postCategory: 'tech',
      postName: '开发工程师',
      deptName: '研发部',
      postSort: 1,
      status: '0',
      createTime: '2026-03-07 10:00:00'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/system/post', () => ({
  listPost: postMocks.listPost,
  addPost: postMocks.addPost,
  delPost: postMocks.delPost,
  getPost: postMocks.getPost,
  updatePost: postMocks.updatePost,
  deptTreeSelect: postMocks.deptTreeSelect
}));

const TABLE_DATA_SYMBOL = Symbol('post-table-data');

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

const ElTreeStub = defineComponent({
  name: 'ElTree',
  props: {
    filterNodeMethod: {
      type: Function,
      default: undefined
    }
  },
  emits: ['node-click'],
  setup(props, { emit, expose }) {
    expose({
      filter: (value: string) => props.filterNodeMethod?.(value, { label: '测试部门' }),
      setCurrentKey: vi.fn()
    });
    return () =>
      h('div', [
        h(
          'button',
          {
            class: 'el-tree-node-click',
            onClick: () => emit('node-click', { id: 88, label: '测试部门' })
          },
          'node-click'
        ),
        h(
          'button',
          {
            class: 'tree-filter-miss',
            onClick: () => props.filterNodeMethod?.('不存在', { label: '测试部门' })
          },
          'tree-filter-miss'
        )
      ]);
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

describe('views/system/post/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postMocks.rows = [
      {
        postId: 1,
        deptId: 100,
        postCode: 'dev-001',
        postCategory: 'tech',
        postName: '开发工程师',
        deptName: '研发部',
        postSort: 1,
        status: '0',
        createTime: '2026-03-07 10:00:00'
      }
    ];
    postMocks.deptTreeSelect.mockResolvedValue({
      data: [{ id: 88, label: '测试部门' }]
    });
    postMocks.listPost.mockImplementation(() =>
      Promise.resolve({
        rows: postMocks.rows,
        total: postMocks.rows.length
      })
    );
    postMocks.getPost.mockResolvedValue({
      data: {
        postId: 1,
        deptId: 100,
        postCode: 'dev-001',
        postCategory: 'tech',
        postName: '开发工程师',
        postSort: 1,
        status: '0',
        remark: '',
        deptName: '研发部',
        createTime: '2026-03-07 10:00:00'
      }
    });
    postMocks.addPost.mockResolvedValue(undefined);
    postMocks.updatePost.mockResolvedValue(undefined);
    postMocks.delPost.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(PostView, {
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
            $modal: {
              confirm: postMocks.modalConfirm,
              msgSuccess: postMocks.msgSuccess
            },
            download: postMocks.download
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
          'el-input': true,
          'el-tree': ElTreeStub,
          'el-tree-select': true,
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-select': passthroughStub('ElSelect'),
          'el-option': passthroughStub('ElOption'),
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'dict-tag': true,
          pagination: true,
          'right-toolbar': true,
          'el-dialog': ElDialogStub,
          'el-input-number': true,
          'el-radio-group': passthroughStub('ElRadioGroup'),
          'el-radio': passthroughStub('ElRadio'),
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-button': ElButtonStub
        }
      }
    });

  it('loads department tree and post list on mounted', async () => {
    mountView();
    await flushPromises();

    expect(postMocks.deptTreeSelect).toHaveBeenCalledTimes(1);
    expect(postMocks.listPost).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('filters by clicked department node', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.el-tree-node-click').trigger('click');
    await flushPromises();

    expect(postMocks.listPost).toHaveBeenCalledTimes(2);
    expect(postMocks.listPost).toHaveBeenLastCalledWith(
      expect.objectContaining({
        belongDeptId: 88,
        deptId: undefined,
        pageNum: 1
      })
    );
  });

  it('adds new post', async () => {
    const wrapper = mountView();
    await flushPromises();

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(postMocks.addPost).toHaveBeenCalledTimes(1);
    expect(postMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('updates selected post', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');
    const editButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '修改');
    expect(editButton).toBeDefined();
    await editButton!.trigger('click');
    await flushPromises();

    expect(postMocks.getPost).toHaveBeenCalledWith(1);

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(postMocks.updatePost).toHaveBeenCalledTimes(1);
    expect(postMocks.updatePost).toHaveBeenCalledWith(
      expect.not.objectContaining({
        deptName: expect.anything(),
        createTime: expect.anything()
      })
    );
    expect(postMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('deletes selected post and supports export', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');
    const deleteButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '删除');
    const exportButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '导出');
    expect(deleteButton).toBeDefined();
    expect(exportButton).toBeDefined();

    await deleteButton!.trigger('click');
    await flushPromises();

    expect(postMocks.modalConfirm).toHaveBeenCalledWith('是否确认删除岗位编号为"1"的数据项？');
    expect(postMocks.delPost).toHaveBeenCalledWith([1]);
    expect(postMocks.msgSuccess).toHaveBeenCalledWith('删除成功');

    await exportButton!.trigger('click');
    expect(postMocks.download).toHaveBeenCalledWith(
      'system/post/export',
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      }),
      expect.stringMatching(/^post_\d+\.xlsx$/)
    );
  });

  it('covers filter/query/reset/cancel branches', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.tree-filter-miss').trigger('click');

    const vm = wrapper.vm as unknown as {
      queryParams: {
        deptId?: number;
        belongDeptId?: number;
      };
    };
    vm.queryParams.deptId = 88;
    vm.queryParams.belongDeptId = 99;
    const searchButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '搜索');
    const resetButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '重置');
    expect(searchButton).toBeDefined();
    expect(resetButton).toBeDefined();

    await searchButton!.trigger('click');
    await flushPromises();
    expect(vm.queryParams.belongDeptId).toBeUndefined();

    await resetButton!.trigger('click');
    await flushPromises();
    expect(vm.queryParams.deptId).toBeUndefined();
    expect(vm.queryParams.belongDeptId).toBeUndefined();

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    const cancelButton = wrapper
      .find('.el-dialog-stub[data-title="添加岗位"]')
      .findAll('button.el-button-stub')
      .find((button) => button.text().replace(/\s/g, '') === '取消');
    expect(cancelButton).toBeDefined();
    await cancelButton!.trigger('click');
    await flushPromises();
  });
});
