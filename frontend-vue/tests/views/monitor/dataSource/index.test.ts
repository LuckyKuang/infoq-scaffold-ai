import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import DataSourceView from '@/views/monitor/dataSource/index.vue';

const dataSourceMocks = vi.hoisted(() => ({
  getDataSourceMonitor: vi.fn(),
  modalLoading: vi.fn(),
  closeLoading: vi.fn()
}));

vi.mock('@/api/monitor/dataSource', () => ({
  getDataSourceMonitor: dataSourceMocks.getDataSourceMonitor
}));

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    props: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      percentage: { type: Number, default: undefined },
      type: { type: String, default: '' }
    },
    setup(props, { slots }) {
      return () =>
        h('div', { class: `${name}-stub` }, [
          props.title ? h('div', props.title) : null,
          props.description ? h('div', props.description) : null,
          props.percentage !== undefined ? h('div', String(props.percentage)) : null,
          slots.header?.(),
          slots.default?.()
        ]);
    }
  });

const ElCardStub = defineComponent({
  name: 'ElCard',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, [slots.header?.(), slots.default?.()]);
  }
});

describe('views/monitor/dataSource/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataSourceMocks.getDataSourceMonitor.mockResolvedValue({
      data: {
        summary: {
          dataSourceCount: 1,
          activeConnections: 3,
          idleConnections: 7,
          totalConnections: 10,
          maximumPoolSize: 20,
          threadsAwaitingConnection: 0
        },
        items: [
          {
            name: 'master',
            dbType: 'MySQL',
            metricsReady: true,
            running: true,
            activeConnections: 3,
            idleConnections: 7,
            totalConnections: 10,
            threadsAwaitingConnection: 0,
            maximumPoolSize: 20,
            usagePercent: 15,
            state: 'RUNNING'
          }
        ]
      }
    });
  });

  const mountView = () =>
    mount(DataSourceView, {
      global: {
        config: {
          globalProperties: {
            $modal: {
              loading: dataSourceMocks.modalLoading,
              closeLoading: dataSourceMocks.closeLoading
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-card': ElCardStub,
          'el-alert': passthroughStub('ElAlert'),
          'el-empty': passthroughStub('ElEmpty'),
          'el-tag': passthroughStub('ElTag'),
          'el-progress': passthroughStub('ElProgress')
        }
      }
    });

  it('loads datasource monitor data and only renders safe pool summary fields', async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(dataSourceMocks.modalLoading).toHaveBeenCalledWith('正在加载连接池监控数据，请稍候！');
    expect(dataSourceMocks.getDataSourceMonitor).toHaveBeenCalledTimes(1);
    expect(dataSourceMocks.closeLoading).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('master');
    expect(wrapper.text()).toContain('MySQL');
    expect(wrapper.text()).toContain('运行中');
    expect(wrapper.text()).not.toContain('jdbc:mysql://localhost:3306/infoq');
    expect(wrapper.text()).not.toContain('P6Spy');
  });

  it('shows an error when datasource monitor response omits items', async () => {
    dataSourceMocks.getDataSourceMonitor.mockResolvedValueOnce({
      data: {
        summary: {
          dataSourceCount: 1,
          activeConnections: 3,
          idleConnections: 7,
          totalConnections: 10,
          maximumPoolSize: 20,
          threadsAwaitingConnection: 0
        }
      }
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('连接池监控响应 items 必须是数组');
  });
});
