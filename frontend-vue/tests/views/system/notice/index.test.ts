import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import NoticeView from '@/views/system/notice/index.vue';

const noticeMocks = vi.hoisted(() => ({
  listNotice: vi.fn(),
  getNotice: vi.fn(),
  addNotice: vi.fn(),
  updateNotice: vi.fn(),
  delNotice: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  formResetFields: vi.fn(),
  rows: [
    {
      noticeId: 1,
      noticeTitle: '系统维护通知',
      noticeType: '1',
      status: '0',
      createByName: 'admin',
      createTime: '2026-03-07 10:00:00'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/system/notice', () => ({
  listNotice: noticeMocks.listNotice,
  getNotice: noticeMocks.getNotice,
  addNotice: noticeMocks.addNotice,
  updateNotice: noticeMocks.updateNotice,
  delNotice: noticeMocks.delNotice
}));

const TABLE_DATA_SYMBOL = Symbol('notice-table-data');

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
      resetFields: noticeMocks.formResetFields,
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

describe('views/system/notice/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    noticeMocks.rows = [
      {
        noticeId: 1,
        noticeTitle: '系统维护通知',
        noticeType: '1',
        status: '0',
        createByName: 'admin',
        createTime: '2026-03-07 10:00:00'
      }
    ];
    noticeMocks.listNotice.mockImplementation(() =>
      Promise.resolve({
        rows: noticeMocks.rows,
        total: noticeMocks.rows.length
      })
    );
    noticeMocks.getNotice.mockResolvedValue({
      data: {
        noticeId: 1,
        noticeTitle: '系统维护通知',
        noticeType: '1',
        noticeContent: 'content',
        status: '0',
        createByName: 'admin',
        createTime: '2026-03-07 10:00:00'
      }
    });
    noticeMocks.addNotice.mockResolvedValue(undefined);
    noticeMocks.updateNotice.mockResolvedValue(undefined);
    noticeMocks.delNotice.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(NoticeView, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_notice_status: [
                  { label: '正常', value: '0' },
                  { label: '关闭', value: '1' }
                ],
                sys_notice_type: [
                  { label: '通知', value: '1' },
                  { label: '公告', value: '2' }
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
              confirm: noticeMocks.modalConfirm,
              msgSuccess: noticeMocks.msgSuccess
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
          'right-toolbar': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'dict-tag': true,
          pagination: true,
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-dialog': ElDialogStub,
          'el-radio-group': passthroughStub('ElRadioGroup'),
          'el-radio': passthroughStub('ElRadio'),
          editor: true,
          'el-button': ElButtonStub
        }
      }
    });

  it('loads notice list on mounted', async () => {
    mountView();
    await flushPromises();

    expect(noticeMocks.listNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('adds notice successfully', async () => {
    const wrapper = mountView();
    await flushPromises();

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(noticeMocks.addNotice).toHaveBeenCalledTimes(1);
    expect(noticeMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('updates notice successfully', async () => {
    const wrapper = mountView();
    await flushPromises();

    const editButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Edit' && button.text().trim() === '');
    expect(editButton).toBeDefined();
    await editButton!.trigger('click');
    await flushPromises();

    expect(noticeMocks.getNotice).toHaveBeenCalledWith(1);

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(noticeMocks.updateNotice).toHaveBeenCalledTimes(1);
    expect(noticeMocks.updateNotice).toHaveBeenCalledWith(
      expect.not.objectContaining({
        createByName: expect.anything(),
        createTime: expect.anything()
      })
    );
    expect(noticeMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('deletes notice by row action', async () => {
    const wrapper = mountView();
    await flushPromises();

    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().trim() === '');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(noticeMocks.modalConfirm).toHaveBeenCalledWith(expect.stringContaining('"1"'));
    expect(noticeMocks.delNotice).toHaveBeenCalledWith(1);
    expect(noticeMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('deletes selected notice in batch mode', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const batchDeleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().replace(/\s/g, '') === '删除');
    expect(batchDeleteButton).toBeDefined();
    await batchDeleteButton!.trigger('click');
    await flushPromises();

    expect(noticeMocks.delNotice).toHaveBeenCalledWith([1]);
    expect(noticeMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('supports query/reset and cancel dialog', async () => {
    const wrapper = mountView();
    await flushPromises();

    const searchButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '搜索');
    const resetButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '重置');
    expect(searchButton).toBeDefined();
    expect(resetButton).toBeDefined();

    await searchButton!.trigger('click');
    await flushPromises();
    expect(noticeMocks.listNotice).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageNum: 1
      })
    );

    await resetButton!.trigger('click');
    await flushPromises();
    expect(noticeMocks.formResetFields).toHaveBeenCalled();
    expect(noticeMocks.listNotice).toHaveBeenCalled();

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    const cancelButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '取消');
    expect(cancelButton).toBeDefined();
    await cancelButton!.trigger('click');
    await flushPromises();
    expect(wrapper.find('.el-dialog-stub').exists()).toBe(false);
  });
});
