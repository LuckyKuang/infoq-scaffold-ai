import { useCallback, useEffect, useState } from 'react';
import { DeleteOutlined, DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, Row, Select, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import useDictOptions from '@/hooks/useDictOptions';
import { cleanJobLog, delJobLog, listJobLog } from '@/api/monitor/jobLog';
import type { JobLogQuery, JobLogVO } from '@/api/monitor/jobLog/types';
import DictTag from '@/components/DictTag';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import auth from '@/utils/permission';
import modal from '@/utils/modal';
import { download } from '@/utils/request';

const initialQuery: JobLogQuery = {
  pageNum: 1,
  pageSize: 10,
  jobName: '',
  jobGroup: '',
  handlerKey: '',
  triggerSource: '',
  status: ''
};

export default function JobLogPage() {
  const [query, setQuery] = useState<JobLogQuery>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<JobLogVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const dict = useDictOptions('sys_job_group', 'sys_common_status');

  const loadList = useCallback(async (nextQuery: JobLogQuery) => {
    setLoading(true);
    try {
      const response = await listJobLog(nextQuery);
      setList(response.rows);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList(initialQuery);
  }, [loadList]);

  const columns: ColumnsType<JobLogVO> = [
    { title: '日志ID', dataIndex: 'jobLogId', align: 'center', width: 120 },
    { title: '任务名称', dataIndex: 'jobName', align: 'center' },
    {
      title: '任务分组',
      dataIndex: 'jobGroup',
      align: 'center',
      render: (value: string) => <DictTag options={dict.sys_job_group || []} value={value} />
    },
    { title: '处理器', dataIndex: 'handlerKey', align: 'center' },
    { title: '触发来源', dataIndex: 'triggerSource', align: 'center' },
    {
      title: '执行状态',
      dataIndex: 'status',
      align: 'center',
      render: (value: string) => <DictTag options={dict.sys_common_status || []} value={value} />
    },
    { title: '耗时(毫秒)', dataIndex: 'durationMs', align: 'center' },
    { title: '开始时间', dataIndex: 'startTime', align: 'center' },
    { title: '结束时间', dataIndex: 'endTime', align: 'center' },
    { title: '执行消息', dataIndex: 'jobMessage', align: 'center' },
    { title: '异常信息', dataIndex: 'exceptionInfo', align: 'center' }
  ];

  const handleSearch = () => {
    const next = { ...query, pageNum: 1 };
    setQuery(next);
    loadList(next);
  };

  const handleReset = () => {
    setQuery(initialQuery);
    loadList(initialQuery);
  };

  const handleDelete = async (jobLogId?: string | number | Array<string | number>) => {
    const target = jobLogId || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的任务日志');
      return;
    }
    const display = Array.isArray(target) ? target.join(',') : target;
    const confirmed = await modal.confirm(`是否确认删除任务日志编号为 "${display}" 的数据项？`);
    if (!confirmed) {
      return;
    }
    await delJobLog(target);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList(query);
  };

  const handleClean = async () => {
    const confirmed = await modal.confirm('是否确认清空所有任务日志数据项？');
    if (!confirmed) {
      return;
    }
    await cleanJobLog();
    modal.msgSuccess('清空成功');
    loadList(query);
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {showSearch && (
        <Card>
          <Form layout="inline" className="query-form">
            <Row gutter={16} style={{ width: '100%' }}>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="任务名称" style={{ width: '100%', marginBottom: 12 }}>
                  <Input
                    allowClear
                    placeholder="请输入任务名称"
                    value={query.jobName}
                    onChange={(event) => setQuery((prev) => ({ ...prev, jobName: event.target.value }))}
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="任务分组" style={{ width: '100%', marginBottom: 12 }}>
                  <Select
                    allowClear
                    placeholder="任务分组"
                    style={{ width: '100%' }}
                    value={query.jobGroup || undefined}
                    options={(dict.sys_job_group || []).map((item) => ({ label: item.label, value: item.value }))}
                    onChange={(value) => setQuery((prev) => ({ ...prev, jobGroup: value || '' }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="执行状态" style={{ width: '100%', marginBottom: 12 }}>
                  <Select
                    allowClear
                    placeholder="执行状态"
                    style={{ width: '100%' }}
                    value={query.status || undefined}
                    options={(dict.sys_common_status || []).map((item) => ({ label: item.label, value: item.value }))}
                    onChange={(value) => setQuery((prev) => ({ ...prev, status: value || '' }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Space>
                    <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                      搜索
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={handleReset}>
                      重置
                    </Button>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      )}

      <Card>
        <div className="table-toolbar">
          <Space wrap className="toolbar-buttons">
            {auth.hasPermiOr(['monitor:jobLog:remove']) && (
              <Button className="btn-plain-danger" icon={<DeleteOutlined />} onClick={() => handleDelete()} disabled={selectedIds.length === 0}>
                删除
              </Button>
            )}
            {auth.hasPermiOr(['monitor:jobLog:remove']) && (
              <Button className="btn-plain-danger" icon={<DeleteOutlined />} onClick={handleClean}>
                清空
              </Button>
            )}
            {auth.hasPermiOr(['monitor:jobLog:export']) && (
              <Button
                className="btn-plain-warning"
                icon={<DownloadOutlined />}
                onClick={() => download('/monitor/jobLog/export', { ...query }, `jobLog_${Date.now()}.xlsx`)}
              >
                导出
              </Button>
            )}
          </Space>
          <div className="right-toolbar-wrap">
            <RightToolbar showSearch={showSearch} onShowSearchChange={setShowSearch} onQueryTable={() => loadList(query)} />
          </div>
        </div>

        <Table<JobLogVO>
          rowKey="jobLogId"
          loading={loading}
          bordered
          columns={columns}
          dataSource={list}
          pagination={false}
          rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as Array<string | number>) }}
        />

        <Pagination
          total={total}
          page={query.pageNum}
          limit={query.pageSize}
          onPageChange={({ page, limit }) => {
            const next = { ...query, pageNum: page, pageSize: limit };
            setQuery(next);
            loadList(next);
          }}
        />
      </Card>
    </Space>
  );
}
