import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../helpers/renderWithRouter';
import { useUserStore } from '@/store/modules/user';

const dictOptions = vi.hoisted(() => ({
  sys_job_group: [{ label: '系统任务', value: 'SYSTEM' }],
  sys_job_status: [
    { label: '正常', value: '0' },
    { label: '暂停', value: '1' }
  ],
  sys_job_misfire_policy: [{ label: '默认策略', value: '0' }],
  sys_job_concurrent: [{ label: '禁止并发', value: '1' }],
  sys_common_status: [{ label: '成功', value: '0' }]
}));

vi.mock('@/hooks/useDictOptions', () => ({
  default: (...types: string[]) => Object.fromEntries(types.map((type) => [type, dictOptions[type as keyof typeof dictOptions] || []]))
}));

vi.mock('@/components/Pagination', () => ({
  default: () => <div data-testid="pagination" />
}));

vi.mock('@/components/RightToolbar', () => ({
  default: () => <div data-testid="right-toolbar" />
}));

vi.mock('@/components/DictTag', () => ({
  default: ({
    options = [],
    value
  }: {
    options?: Array<{ label: string; value: string | number }>;
    value?: string | number | Array<string | number>;
  }) => {
    const values = Array.isArray(value) ? value.map(String) : value !== undefined ? [String(value)] : [];
    const text = values.map((item) => options.find((option) => String(option.value) === item)?.label || item).join(',');
    return <span>{text}</span>;
  }
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    Table: ({
      columns = [],
      dataSource = [],
      rowKey = 'key',
      rowSelection
    }: {
      columns?: Array<{
        key?: string;
        dataIndex?: string;
        title?: string;
        render?: (value: unknown, record: Record<string, unknown>, index: number) => React.ReactNode;
      }>;
      dataSource?: Array<Record<string, unknown>>;
      rowKey?: string;
      rowSelection?: {
        selectedRowKeys?: Array<string | number>;
        onChange?: (keys: Array<string | number>) => void;
      };
    }) => (
      <table>
        {rowSelection && (
          <thead>
            <tr>
              <th>
                <input aria-label="select all rows" type="checkbox" />
              </th>
            </tr>
          </thead>
        )}
        <tbody>
          {dataSource.map((record, index) => {
            const key = record[rowKey] as string | number;
            return (
              <tr key={key}>
                {rowSelection && (
                  <td>
                    <input
                      aria-label={`select row ${key}`}
                      checked={rowSelection.selectedRowKeys?.includes(key) || false}
                      type="checkbox"
                      onChange={(event) => rowSelection.onChange?.(event.target.checked ? [key] : [])}
                    />
                  </td>
                )}
                {columns.map((column, columnIndex) => {
                  const value = column.dataIndex ? record[column.dataIndex] : undefined;
                  const content = column.render ? column.render(value, record, index) : value;
                  return <td key={column.key || column.dataIndex || columnIndex}>{content as React.ReactNode}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    )
  };
});

const modalMocks = vi.hoisted(() => ({
  confirm: vi.fn().mockResolvedValue(true),
  msgSuccess: vi.fn(),
  msgWarning: vi.fn(),
  msgError: vi.fn()
}));

vi.mock('@/utils/modal', () => ({
  default: modalMocks
}));

const requestMocks = vi.hoisted(() => ({
  download: vi.fn()
}));

vi.mock('@/utils/request', async () => {
  const actual = await vi.importActual<typeof import('@/utils/request')>('@/utils/request');
  return {
    ...actual,
    download: requestMocks.download
  };
});

vi.mock('@/api/monitor/job', () => ({
  listJob: vi.fn(),
  getJob: vi.fn(),
  addJob: vi.fn(),
  updateJob: vi.fn(),
  delJob: vi.fn(),
  changeJobStatus: vi.fn(),
  runJob: vi.fn(),
  listJobHandlerKeys: vi.fn()
}));

vi.mock('@/api/monitor/jobLog', () => ({
  listJobLog: vi.fn(),
  getJobLog: vi.fn(),
  delJobLog: vi.fn(),
  cleanJobLog: vi.fn()
}));

const { default: JobPage } = await import('@/pages/monitor/job/index');
const { default: JobLogPage } = await import('@/pages/monitor/jobLog/index');
const jobApi = await import('@/api/monitor/job');
const jobLogApi = await import('@/api/monitor/jobLog');

function asResolvedValue<T>(value: unknown): T {
  return value as T;
}

beforeEach(() => {
  vi.clearAllMocks();
  modalMocks.confirm.mockResolvedValue(true);
  useUserStore.setState({
    permissions: [
      'monitor:job:add',
      'monitor:job:edit',
      'monitor:job:remove',
      'monitor:job:export',
      'monitor:job:run',
      'monitor:job:changeStatus',
      'monitor:jobLog:remove',
      'monitor:jobLog:export'
    ]
  });

  vi.mocked(jobApi.listJob).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof jobApi.listJob>>>({
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
      ],
      total: 1
    })
  );
  vi.mocked(jobApi.getJob).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof jobApi.getJob>>>({
      data: {
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
    })
  );
  vi.mocked(jobApi.listJobHandlerKeys).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof jobApi.listJobHandlerKeys>>>({
      data: ['system.noop']
    })
  );
  vi.mocked(jobApi.delJob).mockResolvedValue(asResolvedValue<Awaited<ReturnType<typeof jobApi.delJob>>>(undefined));
  vi.mocked(jobApi.runJob).mockResolvedValue(asResolvedValue<Awaited<ReturnType<typeof jobApi.runJob>>>(undefined));
  vi.mocked(jobApi.changeJobStatus).mockResolvedValue(asResolvedValue<Awaited<ReturnType<typeof jobApi.changeJobStatus>>>(undefined));

  vi.mocked(jobLogApi.listJobLog).mockResolvedValue(
    asResolvedValue<Awaited<ReturnType<typeof jobLogApi.listJobLog>>>({
      rows: [
        {
          jobLogId: 1,
          jobId: 1,
          jobName: '演示任务',
          jobGroup: 'SYSTEM',
          handlerKey: 'system.noop',
          handlerParams: '{}',
          triggerSource: 'manual',
          jobMessage: '执行成功',
          status: '0',
          exceptionInfo: '',
          durationMs: 15,
          startTime: '2026-04-25 13:00:00',
          endTime: '2026-04-25 13:00:15'
        }
      ],
      total: 1
    })
  );
  vi.mocked(jobLogApi.delJobLog).mockResolvedValue(asResolvedValue<Awaited<ReturnType<typeof jobLogApi.delJobLog>>>(undefined));
  vi.mocked(jobLogApi.cleanJobLog).mockResolvedValue(asResolvedValue<Awaited<ReturnType<typeof jobLogApi.cleanJobLog>>>(undefined));
});

describe('pages/monitor scheduler', () => {
  it('renders job page and supports run/delete/export', async () => {
    renderWithRouter(<JobPage />, '/monitor/job');

    expect(await screen.findByPlaceholderText('请输入任务名称')).toBeInTheDocument();
    expect(await screen.findByText('演示任务')).toBeInTheDocument();
    await waitFor(() => {
      expect(jobApi.listJob).toHaveBeenCalled();
      expect(jobApi.listJobHandlerKeys).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    const deleteJobButton = screen.getByRole('button', { name: /删除$/ });
    await waitFor(() => {
      expect(deleteJobButton).not.toBeDisabled();
    });
    fireEvent.click(deleteJobButton);
    await waitFor(() => {
      expect(jobApi.delJob).toHaveBeenCalledWith([1]);
    });

    const runButtons = screen.getAllByRole('button');
    const runButton = runButtons.find((button) => button.querySelector('.anticon-play-circle'));
    expect(runButton).toBeDefined();
    fireEvent.click(runButton!);
    await waitFor(() => {
      expect(jobApi.runJob).toHaveBeenCalledWith(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /导出$/ }));
    expect(requestMocks.download).toHaveBeenCalledWith('/monitor/job/export', expect.any(Object), expect.stringMatching(/^job_\d+\.xlsx$/));
  }, 30000);

  it('renders job log page and supports clean/delete/export', async () => {
    renderWithRouter(<JobLogPage />, '/monitor/jobLog');

    expect(await screen.findByPlaceholderText('请输入任务名称')).toBeInTheDocument();
    expect(await screen.findByText('执行成功')).toBeInTheDocument();
    await waitFor(() => {
      expect(jobLogApi.listJobLog).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    const deleteLogButton = screen.getByRole('button', { name: /删除$/ });
    await waitFor(() => {
      expect(deleteLogButton).not.toBeDisabled();
    });
    fireEvent.click(deleteLogButton);
    await waitFor(() => {
      expect(jobLogApi.delJobLog).toHaveBeenCalledWith([1]);
    });

    fireEvent.click(screen.getByRole('button', { name: /清空$/ }));
    await waitFor(() => {
      expect(jobLogApi.cleanJobLog).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /导出$/ }));
    expect(requestMocks.download).toHaveBeenCalledWith('/monitor/jobLog/export', expect.any(Object), expect.stringMatching(/^jobLog_\d+\.xlsx$/));
  }, 30000);
});
