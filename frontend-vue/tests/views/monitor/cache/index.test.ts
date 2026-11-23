import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import CacheView from '@/views/monitor/cache/index.vue';

const cacheMocks = vi.hoisted(() => ({
  getCache: vi.fn(),
  modalLoading: vi.fn(),
  closeLoading: vi.fn(),
  chartInit: vi.fn(),
  chartSetOption: vi.fn(),
  chartResize: vi.fn(),
  chartDispose: vi.fn()
}));

vi.mock('@/api/monitor/cache', () => ({
  getCache: cacheMocks.getCache
}));

vi.mock('@/utils/echarts', () => ({
  init: cacheMocks.chartInit
}));

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

const ElCardStub = defineComponent({
  name: 'ElCard',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, [slots.header?.(), slots.default?.()]);
  }
});

describe('views/monitor/cache/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheMocks.getCache.mockResolvedValue({
      data: {
        info: {
          redis_version: '7.2.0',
          redis_mode: 'standalone',
          tcp_port: '6379',
          connected_clients: '8',
          uptime_in_days: '12',
          used_memory_human: '123.45',
          used_cpu_user_children: '3.14',
          maxmemory_human: '1G',
          aof_enabled: '1',
          rdb_last_bgsave_status: 'ok',
          instantaneous_input_kbps: '10',
          instantaneous_output_kbps: '12'
        },
        dbSize: 128,
        commandStats: [
          { name: 'get', value: 20 },
          { name: 'set', value: 10 }
        ]
      }
    });
    cacheMocks.chartInit.mockReturnValue({
      setOption: cacheMocks.chartSetOption,
      resize: cacheMocks.chartResize,
      dispose: cacheMocks.chartDispose
    });
  });

  const mounted = new Set<ReturnType<typeof mount>>();
  const unmountView = (wrapper: ReturnType<typeof mount>) => {
    mounted.delete(wrapper);
    wrapper.unmount();
  };
  afterEach(() => {
    mounted.forEach(unmountView);
  });

  const mountView = (options: { errorHandler?: (error: unknown) => void } = {}) => {
    const wrapper = mount(CacheView, {
      global: {
        config: {
          errorHandler: options.errorHandler,
          globalProperties: {
            $modal: {
              loading: cacheMocks.modalLoading,
              closeLoading: cacheMocks.closeLoading
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-card': ElCardStub,
          Monitor: true,
          PieChart: true,
          Odometer: true
        }
      }
    });
    mounted.add(wrapper);
    return wrapper;
  };

  it('loads cache monitor data and initializes charts', async () => {
    mountView();
    await flushPromises();

    expect(cacheMocks.modalLoading).toHaveBeenCalledWith('正在加载缓存监控数据，请稍候！');
    expect(cacheMocks.getCache).toHaveBeenCalledTimes(1);
    expect(cacheMocks.closeLoading).toHaveBeenCalledTimes(1);
    expect(cacheMocks.chartInit).toHaveBeenCalledTimes(2);
    expect(cacheMocks.chartSetOption).toHaveBeenCalledTimes(2);
  });

  it('handles window resize for both charts', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    mountView();
    await flushPromises();

    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    const resizeHandler = addEventListenerSpy.mock.calls.find((call) => call[0] === 'resize')?.[1] as EventListener;
    expect(resizeHandler).toBeDefined();
    resizeHandler(new Event('resize'));

    expect(cacheMocks.chartResize).toHaveBeenCalledTimes(2);
    addEventListenerSpy.mockRestore();
  });

  it('closes the loading mask when the cache request fails and creates no charts', async () => {
    cacheMocks.getCache.mockRejectedValueOnce(new Error('boom'));
    const errorHandler = vi.fn();
    const wrapper = mountView({ errorHandler });
    await flushPromises();

    expect(cacheMocks.modalLoading).toHaveBeenCalledTimes(1);
    expect(cacheMocks.closeLoading).toHaveBeenCalledTimes(1);
    expect(cacheMocks.chartInit).not.toHaveBeenCalled();
    expect(errorHandler).toHaveBeenCalledTimes(1);
    unmountView(wrapper);
  });

  it('removes the resize listener and disposes both charts on unmount', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const wrapper = mountView();
    await flushPromises();
    const resizeHandler = addSpy.mock.calls.find((call) => call[0] === 'resize')?.[1];

    unmountView(wrapper);

    expect(removeSpy).toHaveBeenCalledWith('resize', resizeHandler);
    expect(cacheMocks.chartDispose).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('resize'));
    expect(cacheMocks.chartResize).not.toHaveBeenCalled();
  });

  it('does not initialize charts when the page unmounts before the request resolves', async () => {
    let resolveCache!: (value: unknown) => void;
    cacheMocks.getCache.mockReturnValueOnce(new Promise((resolve) => (resolveCache = resolve)));
    const wrapper = mountView();
    unmountView(wrapper);
    resolveCache({ data: { info: {}, commandStats: [] } });
    await flushPromises();

    expect(cacheMocks.chartInit).not.toHaveBeenCalled();
    expect(cacheMocks.closeLoading).toHaveBeenCalledTimes(1);
  });
});
