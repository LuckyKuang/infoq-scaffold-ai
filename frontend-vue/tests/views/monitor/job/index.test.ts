import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import JobView from '@/views/monitor/job/index.vue';

const jobMocks = vi.hoisted(() => ({
  listJob: vi.fn(),
  getJob: vi.fn(),
  addJob: vi.fn(),
  updateJob: vi.fn(),
  delJob: vi.fn(),
  changeJobStatus: vi.fn(),
  runJob: vi.fn(),
  listJobHandlerKeys: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  download: vi.fn(),
  rows: [
    {
      jobId: 1,
      jobName: '演示任务',
      jobGroup: 'SYSTEM',
      handlerKey: 'system.noop',
      handlerParams: '{}',
      cronExpression: '0 0/30 * * * ?',
      misfirePolicy: '0',
      concurrent: '1',
      status: '1',
      remark: 'demo'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/monitor/job', () => ({
  listJob: jobMocks.listJob,
  getJob: jobMocks.getJob,
  addJob: jobMocks.addJob,
  updateJob: jobMocks.updateJob,
  delJob: jobMocks.delJob,
  changeJobStatus: jobMocks.changeJobStatus,
  runJob: jobMocks.runJob,
  listJobHandlerKeys: jobMocks.listJobHandlerKeys
}));

const TABLE_DATA_SYMBOL = Symbol('job-table-data');

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
      resetFields: vi.fn(),
      validate: (callback: (valid: boolean) => void) => callback(true)
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
          onClick: (event: MouseEvent) => emit('click', event)
        },
        slots.default?.()
      );
  }
});

const ElSwitchStub = defineComponent({
  name: 'ElSwitch',
  props: {
    modelValue: {
      type: String,
      default: '1'
    }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          class: 'el-switch-stub',
          onClick: () => {
            const next = props.modelValue === '0' ? '1' : '0';
            emit('update:modelValue', next);
            emit('change', next);
          }
        },
        props.modelValue
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

describe('views/monitor/job/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobMocks.listJob.mockResolvedValue({
      rows: jobMocks.rows,
      total: jobMocks.rows.length
    });
    jobMocks.getJob.mockResolvedValue({
      data: jobMocks.rows[0]
    });
    jobMocks.listJobHandlerKeys.mockResolvedValue({
      data: ['system.noop']
    });
    jobMocks.changeJobStatus.mockResolvedValue(undefined);
    jobMocks.runJob.mockResolvedValue(undefined);
    jobMocks.delJob.mockResolvedValue(undefined);
    jobMocks.addJob.mockResolvedValue(undefined);
    jobMocks.updateJob.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(JobView, {
      global: {
        config: {
          globalProperties: {
            useDict: (...names: string[]) => {
              const result: Record<string, unknown> = {};
              if (names.includes('sys_job_group')) {
                result.sys_job_group = [{ label: '系统任务', value: 'SYSTEM' }];
              }
              if (names.includes('sys_job_status')) {
                result.sys_job_status = [
                  { label: '正常', value: '0' },
                  { label: '暂停', value: '1' }
                ];
              }
              if (names.includes('sys_job_misfire_policy')) {
                result.sys_job_misfire_policy = [{ label: '默认策略', value: '0' }];
              }
              if (names.includes('sys_job_concurrent')) {
                result.sys_job_concurrent = [{ label: '禁止并发', value: '1' }];
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
              confirm: jobMocks.modalConfirm,
              msgSuccess: jobMocks.msgSuccess
            },
            download: jobMocks.download
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
          'el-radio-group': passthroughStub('ElRadioGroup'),
          'el-radio': passthroughStub('ElRadio'),
          'el-dialog': passthroughStub('ElDialog'),
          'right-toolbar': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'dict-tag': true,
          pagination: true,
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-button': ElButtonStub,
          'el-switch': ElSwitchStub
        }
      }
    });

  it('loads list and handler options on mounted', async () => {
    mountView();
    await flushPromises();

    expect(jobMocks.listJob).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
    expect(jobMocks.listJobHandlerKeys).toHaveBeenCalledTimes(1);
  });

  it('deletes selected jobs', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().replace(/\s/g, '') === '删除');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(jobMocks.delJob).toHaveBeenCalledWith([1]);
    expect(jobMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('changes job status and runs job immediately', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.el-switch-stub').trigger('click');
    await flushPromises();
    expect(jobMocks.changeJobStatus).toHaveBeenCalledWith(1, '0');

    const runButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'VideoPlay');
    expect(runButton).toBeDefined();
    await runButton!.trigger('click');
    await flushPromises();

    expect(jobMocks.runJob).toHaveBeenCalledWith(1);
    expect(jobMocks.msgSuccess).toHaveBeenCalledWith('执行请求已提交');
  });

  it('exports job list', async () => {
    const wrapper = mountView();
    await flushPromises();

    const exportButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '导出');
    expect(exportButton).toBeDefined();
    await exportButton!.trigger('click');

    expect(jobMocks.download).toHaveBeenCalledWith(
      'monitor/job/export',
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      }),
      expect.stringMatching(/^job_\d+\.xlsx$/)
    );
  });
});
