import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import OssConfigView from '@/views/system/oss/config.vue';

const ossConfigMocks = vi.hoisted(() => ({
  listOssConfig: vi.fn(),
  getOssConfig: vi.fn(),
  addOssConfig: vi.fn(),
  updateOssConfig: vi.fn(),
  delOssConfig: vi.fn(),
  changeOssConfigStatus: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  rows: [
    {
      ossConfigId: 1,
      configKey: 'minio',
      endpoint: '127.0.0.1:9000',
      domain: '127.0.0.1:9000',
      bucketName: 'bucket',
      prefix: 'test',
      region: 'cn',
      accessPolicy: '1',
      status: '0'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/system/ossConfig', () => ({
  listOssConfig: ossConfigMocks.listOssConfig,
  getOssConfig: ossConfigMocks.getOssConfig,
  addOssConfig: ossConfigMocks.addOssConfig,
  updateOssConfig: ossConfigMocks.updateOssConfig,
  delOssConfig: ossConfigMocks.delOssConfig,
  changeOssConfigStatus: ossConfigMocks.changeOssConfigStatus
}));

const TABLE_DATA_SYMBOL = Symbol('oss-config-table-data');

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

describe('views/system/oss/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ossConfigMocks.rows = [
      {
        ossConfigId: 1,
        configKey: 'minio',
        endpoint: '127.0.0.1:9000',
        domain: '127.0.0.1:9000',
        bucketName: 'bucket',
        prefix: 'test',
        region: 'cn',
        accessPolicy: '1',
        status: '0'
      }
    ];
    ossConfigMocks.listOssConfig.mockImplementation(() =>
      Promise.resolve({
        rows: ossConfigMocks.rows,
        total: ossConfigMocks.rows.length
      })
    );
    ossConfigMocks.getOssConfig.mockResolvedValue({
      data: {
        ossConfigId: 1,
        configKey: 'minio',
        accessKey: 'access',
        secretKey: 'secret',
        bucketName: 'bucket',
        prefix: 'test',
        endpoint: '127.0.0.1:9000',
        domain: '127.0.0.1:9000',
        isHttps: 'N',
        accessPolicy: '1',
        region: 'cn',
        status: '0',
        createTime: '2026-03-07 10:00:00',
        createByName: 'admin'
      }
    });
    ossConfigMocks.addOssConfig.mockResolvedValue(undefined);
    ossConfigMocks.updateOssConfig.mockResolvedValue(undefined);
    ossConfigMocks.delOssConfig.mockResolvedValue(undefined);
    ossConfigMocks.changeOssConfigStatus.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(OssConfigView, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_yes_no: [
                  { label: '是', value: 'Y' },
                  { label: '否', value: 'N' }
                ]
              }),
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            $modal: {
              confirm: ossConfigMocks.modalConfirm,
              msgSuccess: ossConfigMocks.msgSuccess
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
          'el-switch': ElSwitchStub,
          'el-tag': passthroughStub('ElTag'),
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'right-toolbar': true,
          pagination: true,
          'el-dialog': ElDialogStub,
          'el-radio-group': passthroughStub('ElRadioGroup'),
          'el-radio': passthroughStub('ElRadio'),
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-button': ElButtonStub
        }
      }
    });

  it('loads oss config list on mounted', async () => {
    mountView();
    await flushPromises();

    expect(ossConfigMocks.listOssConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('adds oss config successfully', async () => {
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

    expect(ossConfigMocks.addOssConfig).toHaveBeenCalledTimes(1);
    expect(ossConfigMocks.msgSuccess).toHaveBeenCalledWith('新增成功');
  });

  it('updates oss config successfully', async () => {
    const wrapper = mountView();
    await flushPromises();

    const editButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Edit' && button.text().trim() === '');
    expect(editButton).toBeDefined();
    await editButton!.trigger('click');
    await flushPromises();

    expect(ossConfigMocks.getOssConfig).toHaveBeenCalledWith(1);

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(ossConfigMocks.updateOssConfig).toHaveBeenCalledTimes(1);
    expect(ossConfigMocks.updateOssConfig).toHaveBeenCalledWith(
      expect.not.objectContaining({
        createTime: expect.anything(),
        createByName: expect.anything()
      })
    );
    expect(ossConfigMocks.msgSuccess).toHaveBeenCalledWith('新增成功');
  });

  it('deletes selected oss config', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');
    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().replace(/\s/g, '') === '删除');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(ossConfigMocks.delOssConfig).toHaveBeenCalledWith([1]);
    expect(ossConfigMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('changes oss config status', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.el-switch-stub').trigger('click');
    await flushPromises();

    expect(ossConfigMocks.changeOssConfigStatus).toHaveBeenCalledWith(1, '1', 'minio');
    expect(ossConfigMocks.msgSuccess).toHaveBeenCalledWith('停用成功');
  });

  it('covers query/reset, cancel dialog and status confirm-cancel branch', async () => {
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
    expect(ossConfigMocks.listOssConfig).toHaveBeenCalledTimes(3);

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    const cancelButton = wrapper
      .find('.el-dialog-stub[data-title="添加对象存储配置"]')
      .findAll('button.el-button-stub')
      .find((button) => button.text().replace(/\s/g, '') === '取消');
    expect(cancelButton).toBeDefined();
    await cancelButton!.trigger('click');
    await flushPromises();

    ossConfigMocks.modalConfirm.mockRejectedValueOnce(new Error('cancelled'));
    await wrapper.find('button.el-switch-stub').trigger('click');
    await flushPromises();
    expect(ossConfigMocks.changeOssConfigStatus).not.toHaveBeenCalled();
    expect(ossConfigMocks.rows[0].status).toBe('0');
  });
});
