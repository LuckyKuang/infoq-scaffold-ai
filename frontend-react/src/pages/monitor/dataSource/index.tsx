import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Empty, Progress, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DatabaseOutlined, LinkOutlined, LoadingOutlined } from '@ant-design/icons';
import { getDataSourceMonitor } from '@/api/monitor/dataSource';
import type { DataSourceMonitorSummary, DataSourceMonitorVO, DataSourcePoolVO } from '@/api/monitor/dataSource/types';
import modal from '@/utils/modal';

const createDefaultSummary = (): DataSourceMonitorSummary => ({
  dataSourceCount: 0,
  activeConnections: 0,
  idleConnections: 0,
  totalConnections: 0,
  maximumPoolSize: 0,
  threadsAwaitingConnection: 0
});

const createDefaultMonitor = (): DataSourceMonitorVO => ({
  summary: createDefaultSummary(),
  items: []
});

const normalizePool = (pool?: Partial<DataSourcePoolVO>): DataSourcePoolVO => ({
  name: pool?.name ?? '',
  dbType: pool?.dbType ?? '',
  metricsReady: pool?.metricsReady ?? false,
  running: pool?.running ?? false,
  activeConnections: pool?.activeConnections ?? null,
  idleConnections: pool?.idleConnections ?? null,
  totalConnections: pool?.totalConnections ?? null,
  threadsAwaitingConnection: pool?.threadsAwaitingConnection ?? null,
  maximumPoolSize: pool?.maximumPoolSize ?? null,
  usagePercent: pool?.usagePercent ?? null,
  state: pool?.state ?? 'UNINITIALIZED'
});

const normalizeMonitor = (value?: Partial<DataSourceMonitorVO> | null): DataSourceMonitorVO => {
  if (!Array.isArray(value?.items)) {
    throw new Error('连接池监控响应 items 必须是数组');
  }
  return {
    summary: {
      ...createDefaultSummary(),
      ...(value?.summary ?? {})
    },
    items: value.items.map((item) => normalizePool(item))
  };
};

const displayText = (value?: string | null) => value || '-';

const displayCount = (value?: number | null) => (value ?? 0).toString();

const formatPercent = (value?: number | null) => `${Number(value ?? 0).toFixed(2)}%`;

const getStateMeta = (state?: string) =>
  (
    ({
      RUNNING: { label: '运行中', color: 'success' },
      BUSY: { label: '繁忙', color: 'orange' },
      SATURATED: { label: '饱和', color: 'error' },
      UNINITIALIZED: { label: '未初始化', color: 'default' }
    }) as Record<string, { label: string; color: string }>
  )[state || ''] || { label: state || '-', color: 'default' };

export default function DataSourcePage() {
  const [monitor, setMonitor] = useState<DataSourceMonitorVO>(createDefaultMonitor);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadMonitor = async () => {
      modal.loading('正在加载连接池监控数据，请稍候！');
      setErrorMessage('');
      try {
        const response = await getDataSourceMonitor();
        setMonitor(normalizeMonitor(response.data));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '加载连接池监控数据失败');
      } finally {
        modal.closeLoading();
      }
    };

    loadMonitor();
  }, []);

  const columns = useMemo<ColumnsType<DataSourcePoolVO>>(
    () => [
      {
        title: '数据源',
        dataIndex: 'name',
        key: 'name',
        width: 180,
        render: (_, record) => (
          <Space orientation="vertical" size={2}>
            <Typography.Text strong>{displayText(record.name)}</Typography.Text>
            <Typography.Text type="secondary">{displayText(record.dbType)}</Typography.Text>
          </Space>
        )
      },
      {
        title: '状态',
        dataIndex: 'state',
        key: 'state',
        width: 140,
        render: (value: string, record) => {
          const meta = getStateMeta(value);
          return (
            <Space orientation="vertical" size={4}>
              <Tag color={meta.color}>{meta.label}</Tag>
              <Typography.Text type="secondary">{record.running ? '连接池已启动' : '连接池未启动'}</Typography.Text>
            </Space>
          );
        }
      },
      {
        title: '连接概览',
        key: 'connections',
        width: 170,
        render: (_, record) => (
          <Space orientation="vertical" size={2}>
            <span>活跃 {displayCount(record.activeConnections)}</span>
            <span>空闲 {displayCount(record.idleConnections)}</span>
            <span>总数 {displayCount(record.totalConnections)}</span>
          </Space>
        )
      },
      {
        title: '池容量',
        key: 'capacity',
        width: 160,
        render: (_, record) => (
          <Space orientation="vertical" size={2}>
            <span>最大 {displayCount(record.maximumPoolSize)}</span>
            <span>等待 {displayCount(record.threadsAwaitingConnection)}</span>
          </Space>
        )
      },
      {
        title: '等待线程',
        dataIndex: 'threadsAwaitingConnection',
        key: 'threadsAwaitingConnection',
        width: 110,
        align: 'center',
        render: (value: number | null) => displayCount(value)
      },
      {
        title: '占用率',
        dataIndex: 'usagePercent',
        key: 'usagePercent',
        width: 180,
        render: (value: number | null) => {
          const usage = value ?? 0;
          return (
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text style={{ color: usage >= 80 ? '#cf1322' : undefined }}>{formatPercent(usage)}</Typography.Text>
              <Progress percent={usage} size="small" status={usage >= 90 ? 'exception' : undefined} />
            </Space>
          );
        }
      }
    ],
    []
  );

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {errorMessage ? <Alert type="error" showIcon title={errorMessage} /> : null}

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card hoverable>
            <Statistic title="数据源数" value={monitor.summary.dataSourceCount} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card hoverable>
            <Statistic title="活跃连接" value={monitor.summary.activeConnections} prefix={<LinkOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card hoverable>
            <Statistic title="空闲连接" value={monitor.summary.idleConnections} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card hoverable>
            <Statistic title="等待线程" value={monitor.summary.threadsAwaitingConnection} prefix={<LoadingOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card hoverable title="连接池监控">
        <Table<DataSourcePoolVO>
          rowKey="name"
          columns={columns}
          dataSource={monitor.items}
          pagination={false}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description="暂无连接池数据" /> }}
        />
      </Card>
    </Space>
  );
}
