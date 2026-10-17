import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import JobLogView from '@/views/monitor/jobLog/index.vue';

const jobLogMocks = vi.hoisted(() => ({
  listJobLog: vi.fn(),
  delJobLog: vi.fn(),
  cleanJobLog: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  download: vi.fn(),
  rows: [
    {
      jobLogId: 1,
      jobId: 1,
      jobName: '演示任务',
      jobGroup: 'SYSTEM',
      handlerKey: 'system.noop',
      triggerSource: 'manual',
      status: '0',
      durationMs: 15,
      startTime: '2026-04-25 13:00:00',
      endTime: '2026-04-25 13:00:15',
      jobMessage: '执行成功',
      exceptionInfo: ''
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/monitor/jobLog', () => ({
  listJobLog: jobLogMocks.listJobLog,
  delJobLog: jobLogMocks.delJobLog,
  cleanJobLog: jobLogMocks.cleanJobLog
}));

const TABLE_DATA_SYMBOL = Symbol('job-log-table-data');

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
      resetFields: vi.fn()
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

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

describe('views/monitor/jobLog/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobLogMocks.listJobLog.mockResolvedValue({
      rows: jobLogMocks.rows,
      total: jobLogMocks.rows.length
    });
    jobLogMocks.delJobLog.mockResolvedValue(undefined);
    jobLogMocks.cleanJobLog.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(JobLogView, {
      global: {
        config: {
          globalProperties: {
            useDict: (...names: string[]) => {
              const result: Record<string, unknown> = {};
              if (names.includes('sys_job_group')) {
                result.sys_job_group = [{ label: '系统任务', value: 'SYSTEM' }];
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
            $modal: {
              confirm: jobLogMocks.modalConfirm,
              msgSuccess: jobLogMocks.msgSuccess
            },
            download: jobLogMocks.download
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
          'el-button': ElButtonStub
        }
      }
    });

  it('loads logs on mounted', async () => {
    mountView();
    await flushPromises();

    expect(jobLogMocks.listJobLog).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('deletes selected logs', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');
    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().replace(/\s/g, '') === '删除');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(jobLogMocks.delJobLog).toHaveBeenCalledWith([1]);
    expect(jobLogMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('cleans and exports logs', async () => {
    const wrapper = mountView();
    await flushPromises();

    const cleanButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '清空');
    const exportButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '导出');
    expect(cleanButton).toBeDefined();
    expect(exportButton).toBeDefined();

    await cleanButton!.trigger('click');
    await flushPromises();
    expect(jobLogMocks.cleanJobLog).toHaveBeenCalledTimes(1);
    expect(jobLogMocks.msgSuccess).toHaveBeenCalledWith('清空成功');

    await exportButton!.trigger('click');
    expect(jobLogMocks.download).toHaveBeenCalledWith(
      'monitor/jobLog/export',
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      }),
      expect.stringMatching(/^jobLog_\d+\.xlsx$/)
    );
  });
});
