import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../helpers/renderWithRouter';

const dataSourceMocks = vi.hoisted(() => ({
  getDataSourceMonitor: vi.fn(),
  modalLoading: vi.fn(),
  modalCloseLoading: vi.fn()
}));

vi.mock('@/api/monitor/dataSource', () => ({
  getDataSourceMonitor: dataSourceMocks.getDataSourceMonitor
}));

vi.mock('@/utils/modal', () => ({
  default: {
    loading: dataSourceMocks.modalLoading,
    closeLoading: dataSourceMocks.modalCloseLoading,
    msgSuccess: vi.fn(),
    msgWarning: vi.fn(),
    msgError: vi.fn(),
    confirm: vi.fn()
  }
}));

const { default: DataSourcePage } = await import('@/pages/monitor/dataSource/index');

describe('pages/dataSource', () => {
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

  it('loads datasource monitor data and only renders safe pool summary fields', async () => {
    renderWithRouter(<DataSourcePage />, '/monitor/dataSource');

    expect(await screen.findByText('连接池监控')).toBeInTheDocument();
    await waitFor(() => {
      expect(dataSourceMocks.getDataSourceMonitor).toHaveBeenCalledTimes(1);
    });

    expect(dataSourceMocks.modalLoading).toHaveBeenCalledWith('正在加载连接池监控数据，请稍候！');
    expect(dataSourceMocks.modalCloseLoading).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('master')).toBeInTheDocument();
    expect(await screen.findByText('MySQL')).toBeInTheDocument();
    expect(await screen.findByText('运行中')).toBeInTheDocument();
    expect(screen.queryByText('jdbc:mysql://localhost:3306/infoq')).not.toBeInTheDocument();
    expect(screen.queryByText('P6Spy')).not.toBeInTheDocument();
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

    renderWithRouter(<DataSourcePage />, '/monitor/dataSource');

    expect(await screen.findByText('连接池监控响应 items 必须是数组')).toBeInTheDocument();
  });
});
