import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../helpers/renderWithRouter';

const cacheMocks = vi.hoisted(() => ({
  getCache: vi.fn(),
  modalLoading: vi.fn(),
  modalCloseLoading: vi.fn(),
  chartInit: vi.fn(),
  chartSetOption: vi.fn(),
  chartResize: vi.fn(),
  chartDispose: vi.fn()
}));

const originalResizeObserver = globalThis.ResizeObserver;

const resizeObserverMocks = vi.hoisted(() => ({
  instances: [] as Array<{
    callback: ResizeObserverCallback;
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }>
}));

vi.mock('@/api/monitor/cache', () => ({
  getCache: cacheMocks.getCache
}));

vi.mock('@/utils/modal', () => ({
  default: {
    loading: cacheMocks.modalLoading,
    closeLoading: cacheMocks.modalCloseLoading,
    msgSuccess: vi.fn(),
    msgWarning: vi.fn(),
    msgError: vi.fn(),
    confirm: vi.fn()
  }
}));

vi.mock('@/utils/echarts', () => ({
  default: {
    init: cacheMocks.chartInit
  }
}));

const { default: CachePage } = await import('@/pages/monitor/cache/index');

describe('pages/cache', () => {
  let chartWidth = 420;
  let chartHeight = 420;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    resizeObserverMocks.instances.length = 0;
    chartWidth = 420;
    chartHeight = 420;

    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        resizeObserverMocks.instances.push({
          callback,
          observe: this.observe,
          unobserve: this.unobserve,
          disconnect: this.disconnect
        });
      }
    }

    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
    vi.spyOn(HTMLDivElement.prototype, 'clientWidth', 'get').mockImplementation(() => chartWidth);
    vi.spyOn(HTMLDivElement.prototype, 'clientHeight', 'get').mockImplementation(() => chartHeight);
    cacheMocks.getCache.mockResolvedValue({
      data: {
        dbSize: 128,
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
        commandStats: [
          { name: 'get', value: '20' },
          { name: 'set', value: '10' }
        ]
      }
    });
    cacheMocks.chartInit.mockReturnValue({
      setOption: cacheMocks.chartSetOption,
      resize: cacheMocks.chartResize,
      dispose: cacheMocks.chartDispose
    });
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });

  it('loads cache metrics and initializes pie and gauge charts after container sizes are ready', async () => {
    renderWithRouter(<CachePage />, '/monitor/cache');

    expect(screen.getByText('基本信息')).toBeInTheDocument();

    await waitFor(() => {
      expect(cacheMocks.getCache).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('cache-command-chart')).toBeInTheDocument();
    expect(await screen.findByTestId('cache-memory-chart')).toBeInTheDocument();
    await waitFor(() => {
      expect(cacheMocks.chartInit).toHaveBeenCalledTimes(2);
    });

    expect(cacheMocks.modalLoading).toHaveBeenCalledWith('正在加载缓存监控数据，请稍候！');
    expect(cacheMocks.modalCloseLoading).toHaveBeenCalledTimes(1);
    expect(resizeObserverMocks.instances).toHaveLength(1);
    expect(resizeObserverMocks.instances[0]?.observe).toHaveBeenCalledTimes(2);
    expect(cacheMocks.chartSetOption).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        series: [expect.objectContaining({ type: 'pie', data: [{ name: 'get', value: '20' }, { name: 'set', value: '10' }] })]
      })
    );
    expect(cacheMocks.chartSetOption).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        series: [expect.objectContaining({ type: 'gauge', data: [expect.objectContaining({ value: 123.45, name: '内存消耗' })] })]
      })
    );
  });

  it('waits for non-zero container sizes before initializing charts', async () => {
    chartWidth = 0;

    renderWithRouter(<CachePage />, '/monitor/cache');

    await waitFor(() => {
      expect(cacheMocks.getCache).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(resizeObserverMocks.instances).toHaveLength(1);
    });

    expect(cacheMocks.chartInit).not.toHaveBeenCalled();

    chartWidth = 420;
    resizeObserverMocks.instances[0]?.callback([], {} as ResizeObserver);

    await waitFor(() => {
      expect(cacheMocks.chartInit).toHaveBeenCalledTimes(2);
    });
  });

  it('ignores ResizeObserver callbacks when chart sizes stay unchanged after initialization', async () => {
    renderWithRouter(<CachePage />, '/monitor/cache');

    await waitFor(() => {
      expect(cacheMocks.chartInit).toHaveBeenCalledTimes(2);
    });

    const resizeObserver = resizeObserverMocks.instances[0];
    expect(resizeObserver).toBeDefined();
    resizeObserver?.callback([], {} as ResizeObserver);

    expect(cacheMocks.chartResize).not.toHaveBeenCalled();
  });

  it('resizes through ResizeObserver only after chart sizes change and disposes both charts with the page lifecycle', async () => {
    const { unmount } = renderWithRouter(<CachePage />, '/monitor/cache');

    await waitFor(() => {
      expect(cacheMocks.chartInit).toHaveBeenCalledTimes(2);
    });

    const resizeObserver = resizeObserverMocks.instances[0];
    expect(resizeObserver).toBeDefined();
    chartWidth = 520;
    resizeObserver?.callback([], {} as ResizeObserver);

    expect(cacheMocks.chartResize).toHaveBeenCalledTimes(2);

    unmount();

    expect(resizeObserver?.disconnect).toHaveBeenCalledTimes(1);
    expect(cacheMocks.chartDispose).toHaveBeenCalledTimes(2);
  });
});
