import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import ServerView from '@/views/monitor/server/index.vue';

const serverMocks = vi.hoisted(() => ({
  getServer: vi.fn(),
  modalLoading: vi.fn(),
  closeLoading: vi.fn()
}));

vi.mock('@/api/monitor/server', () => ({
  getServer: serverMocks.getServer
}));

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    props: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      percentage: { type: Number, default: undefined }
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

describe('views/monitor/server/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverMocks.getServer.mockResolvedValue({
      data: {
        cpu: { cpuNum: 8, used: 21.5, sys: 12.4, wait: 1.2, free: 64.9 },
        mem: { total: 32, used: 10, free: 22, usage: 31.25 },
        jvm: {
          total: 512,
          max: 1024,
          used: 256,
          free: 256,
          usage: 50,
          name: 'OpenJDK 64-Bit Server VM',
          version: '17.0.12',
          startTime: '2026-04-29 10:00:00',
          runTime: '2小时 10分钟'
        },
        sys: {
          osName: 'Windows 11',
          osArch: 'amd64'
        },
        sysFiles: [{ dirName: 'C:/', sysTypeName: 'NTFS', typeName: 'System', total: '100 GB', free: '60 GB', used: '40 GB', usage: 40 }]
      }
    });
  });

  const mountView = () =>
    mount(ServerView, {
      global: {
        config: {
          globalProperties: {
            $modal: {
              loading: serverMocks.modalLoading,
              closeLoading: serverMocks.closeLoading
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-card': ElCardStub,
          'el-alert': passthroughStub('ElAlert'),
          'el-empty': passthroughStub('ElEmpty')
        }
      }
    });

  it('loads server monitor data and renders core fields', async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(serverMocks.modalLoading).toHaveBeenCalledWith('正在加载服务监控数据，请稍候！');
    expect(serverMocks.getServer).toHaveBeenCalledTimes(1);
    expect(serverMocks.closeLoading).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Windows 11');
    expect(wrapper.text()).toContain('OpenJDK 64-Bit Server VM');
    expect(wrapper.text()).toContain('C:/');
    expect(wrapper.text()).not.toContain('127.0.0.1');
    expect(wrapper.text()).not.toContain('C:/Java/jdk-17');
    expect(wrapper.text()).not.toContain('[-Xms256m, -Xmx1024m]');
  });

  it('shows an error when server monitor response omits sysFiles', async () => {
    serverMocks.getServer.mockResolvedValueOnce({
      data: {
        cpu: { cpuNum: 8, used: 21.5, sys: 12.4, wait: 1.2, free: 64.9 },
        mem: { total: 32, used: 10, free: 22, usage: 31.25 },
        jvm: {
          total: 512,
          max: 1024,
          used: 256,
          free: 256,
          usage: 50,
          name: 'OpenJDK 64-Bit Server VM',
          version: '17.0.12',
          startTime: '2026-04-29 10:00:00',
          runTime: '2小时 10分钟'
        },
        sys: {
          osName: 'Windows 11',
          osArch: 'amd64'
        }
      }
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('服务监控响应 sysFiles 必须是数组');
  });
});
