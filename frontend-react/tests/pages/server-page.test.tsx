import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../helpers/renderWithRouter';

const serverMocks = vi.hoisted(() => ({
  getServer: vi.fn(),
  modalLoading: vi.fn(),
  modalCloseLoading: vi.fn()
}));

vi.mock('@/api/monitor/server', () => ({
  getServer: serverMocks.getServer
}));

vi.mock('@/utils/modal', () => ({
  default: {
    loading: serverMocks.modalLoading,
    closeLoading: serverMocks.modalCloseLoading,
    msgSuccess: vi.fn(),
    msgWarning: vi.fn(),
    msgError: vi.fn(),
    confirm: vi.fn()
  }
}));

const { default: ServerPage } = await import('@/pages/monitor/server/index');

describe('pages/server', () => {
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

  it('loads server monitor data and renders host and jvm details', async () => {
    renderWithRouter(<ServerPage />, '/monitor/server');

    expect(await screen.findByText('CPU')).toBeInTheDocument();
    await waitFor(() => {
      expect(serverMocks.getServer).toHaveBeenCalledTimes(1);
    });

    expect(serverMocks.modalLoading).toHaveBeenCalledWith('正在加载服务监控数据，请稍候！');
    expect(serverMocks.modalCloseLoading).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('OpenJDK 64-Bit Server VM')).toBeInTheDocument();
    expect(await screen.findByText('Windows 11')).toBeInTheDocument();
    expect(await screen.findByText('C:/')).toBeInTheDocument();
    expect(screen.queryByText('127.0.0.1')).not.toBeInTheDocument();
    expect(screen.queryByText('C:/Java/jdk-17')).not.toBeInTheDocument();
    expect(screen.queryByText('[-Xms256m, -Xmx1024m]')).not.toBeInTheDocument();
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

    renderWithRouter(<ServerPage />, '/monitor/server');

    expect(await screen.findByText('服务监控响应 sysFiles 必须是数组')).toBeInTheDocument();
  });
});
