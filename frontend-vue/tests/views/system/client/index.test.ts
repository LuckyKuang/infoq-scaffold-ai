import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import ClientView from '@/views/system/client/index.vue';

const clientMocks = vi.hoisted(() => ({
  listClient: vi.fn(),
  getClient: vi.fn(),
  addClient: vi.fn(),
  updateClient: vi.fn(),
  delClient: vi.fn(),
  changeStatus: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  download: vi.fn(),
  rows: [
    {
      id: 1,
      clientId: 'web',
      clientKey: 'web-key',
      clientSecret: 'web-secret',
      grantTypeList: ['password'],
      deviceType: 'pc',
      activeTimeout: 1800,
      timeout: 604800,
      status: '0'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/system/client', () => ({
  listClient: clientMocks.listClient,
  getClient: clientMocks.getClient,
  addClient: clientMocks.addClient,
  updateClient: clientMocks.updateClient,
  delClient: clientMocks.delClient,
  changeStatus: clientMocks.changeStatus
}));

const TABLE_DATA_SYMBOL = Symbol('client-table-data');

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
    return () => h('div', { class: 'el-table-column-stub' }, (slots.default && slots.default({ row: rows.value[0] || {}, $index: 0 })) || []);
  }
});

const ElSwitchStub = defineComponent({
  name: 'ElSwitch',
  props: {
    modelValue: {
      type: String,
      default: '0'
    }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          class: 'el-switch-stub',
          'data-status': props.modelValue,
          onClick: () => {
            const nextValue = props.modelValue === '0' ? '1' : '0';
            emit('update:modelValue', nextValue);
            emit('change', nextValue);
          }
        },
        'switch'
      );
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

describe('views/system/client/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientMocks.rows = [
      {
        id: 1,
        clientId: 'web',
        clientKey: 'web-key',
        clientSecret: 'web-secret',
        grantTypeList: ['password'],
        deviceType: 'pc',
        activeTimeout: 1800,
        timeout: 604800,
        status: '0'
      }
    ];
    clientMocks.listClient.mockImplementation(() =>
      Promise.resolve({
        rows: clientMocks.rows,
        total: clientMocks.rows.length
      })
    );
    clientMocks.getClient.mockResolvedValue({
      data: {
        id: 1,
        clientId: 'web',
        clientKey: 'web-key',
        clientSecret: 'web-secret',
        grantTypeList: ['password'],
        deviceType: 'pc',
        activeTimeout: 1800,
        timeout: 604800,
        status: '0',
        createTime: '2026-03-07 10:00:00',
        createByName: 'admin'
      }
    });
    clientMocks.addClient.mockResolvedValue(undefined);
    clientMocks.updateClient.mockResolvedValue(undefined);
    clientMocks.delClient.mockResolvedValue(undefined);
    clientMocks.changeStatus.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(ClientView, {
      global: {
        config: {
          globalProperties: {
            useDict: (...names: string[]) => {
              const result: Record<string, unknown> = {};
              if (names.includes('sys_normal_disable')) {
                result.sys_normal_disable = [
                  { label: '正常', value: '0' },
                  { label: '停用', value: '1' }
                ];
              }
              if (names.includes('sys_grant_type')) {
                result.sys_grant_type = [{ label: '密码模式', value: 'password' }];
              }
              if (names.includes('sys_device_type')) {
                result.sys_device_type = [{ label: 'PC', value: 'pc' }];
              }
              return reactive(result);
            },
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            $modal: {
              confirm: clientMocks.modalConfirm,
              msgSuccess: clientMocks.msgSuccess
            },
            download: clientMocks.download
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
          'el-switch': ElSwitchStub,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'dict-tag': true,
          'right-toolbar': true,
          pagination: true,
          'el-dialog': ElDialogStub,
          'el-radio-group': passthroughStub('ElRadioGroup'),
          'el-radio': passthroughStub('ElRadio'),
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-icon': passthroughStub('ElIcon'),
          'question-filled': true,
          'i-ep-question-filled': true,
          'el-button': ElButtonStub
        }
      }
    });

  it('loads client list on mounted', async () => {
    mountView();
    await flushPromises();

    expect(clientMocks.listClient).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('adds client successfully', async () => {
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

    expect(clientMocks.addClient).toHaveBeenCalledTimes(1);
    expect(clientMocks.msgSuccess).toHaveBeenCalledWith('修改成功');
  });

  it('updates client successfully', async () => {
    const wrapper = mountView();
    await flushPromises();

    const editButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Edit' && button.text().trim() === '');
    expect(editButton).toBeDefined();
    await editButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.getClient).toHaveBeenCalledWith(1);

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.updateClient).toHaveBeenCalledTimes(1);
    expect(clientMocks.updateClient).toHaveBeenCalledWith(
      expect.not.objectContaining({
        createTime: expect.anything(),
        createByName: expect.anything()
      })
    );
    expect(clientMocks.msgSuccess).toHaveBeenCalledWith('修改成功');
  });

  it('deletes selected client', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().replace(/\s/g, '') === '删除');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(clientMocks.delClient).toHaveBeenCalledWith([1]);
    expect(clientMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('exports client list and changes status', async () => {
    const wrapper = mountView();
    await flushPromises();

    const exportButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '导出');
    expect(exportButton).toBeDefined();
    await exportButton!.trigger('click');
    expect(clientMocks.download).toHaveBeenCalledWith(
      'system/client/export',
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      }),
      expect.stringMatching(/^client_\d+\.xlsx$/)
    );

    await wrapper.find('button.el-switch-stub').trigger('click');
    await flushPromises();

    expect(clientMocks.changeStatus).toHaveBeenCalledWith('web', '1');
    expect(clientMocks.msgSuccess).toHaveBeenCalledWith('停用成功');
  });

  it('covers query/reset, cancel dialog and status rollback on failure', async () => {
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
    expect(clientMocks.listClient).toHaveBeenCalledTimes(3);

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    const cancelButton = wrapper
      .find('.el-dialog-stub[data-title="添加客户端管理"]')
      .findAll('button.el-button-stub')
      .find((button) => button.text().replace(/\s/g, '') === '取消');
    expect(cancelButton).toBeDefined();
    await cancelButton!.trigger('click');
    await flushPromises();

    clientMocks.modalConfirm.mockRejectedValueOnce(new Error('cancelled'));
    await wrapper.find('button.el-switch-stub').trigger('click');
    await flushPromises();

    expect(clientMocks.changeStatus).not.toHaveBeenCalled();
    expect(clientMocks.rows[0].status).toBe('0');
  });
});
