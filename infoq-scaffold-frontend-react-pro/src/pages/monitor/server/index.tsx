import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Empty, Progress, Row, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CodeOutlined, DashboardOutlined, DatabaseOutlined, DesktopOutlined, HddOutlined } from '@ant-design/icons';
import { getServer } from '@/api/monitor/server';
import type { ServerCpu, ServerJvm, ServerMem, ServerMonitorVO, ServerSys, ServerSysFile } from '@/api/monitor/server/types';
import modal from '@/utils/modal';

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed'
};

const labelCellStyle: React.CSSProperties = {
  width: '25%',
  padding: '10px 12px',
  border: '1px solid #f0f0f0',
  background: '#fafafa',
  color: 'rgba(0, 0, 0, 0.65)',
  fontWeight: 600,
  verticalAlign: 'top'
};

const valueCellStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #f0f0f0',
  verticalAlign: 'top',
  wordBreak: 'break-all'
};

const createDefaultCpu = (): ServerCpu => ({
  cpuNum: 0,
  used: 0,
  sys: 0,
  wait: 0,
  free: 0
});

const createDefaultMem = (): ServerMem => ({
  total: 0,
  used: 0,
  free: 0,
  usage: 0
});

const createDefaultJvm = (): ServerJvm => ({
  total: 0,
  max: 0,
  used: 0,
  free: 0,
  usage: 0,
  name: '',
  version: '',
  startTime: '',
  runTime: ''
});

const createDefaultSys = (): ServerSys => ({
  osName: '',
  osArch: ''
});

const createDefaultServer = (): ServerMonitorVO => ({
  cpu: createDefaultCpu(),
  mem: createDefaultMem(),
  jvm: createDefaultJvm(),
  sys: createDefaultSys(),
  sysFiles: []
});

const normalizeServer = (value?: Partial<ServerMonitorVO> | null): ServerMonitorVO => {
  if (!Array.isArray(value?.sysFiles)) {
    throw new Error('服务监控响应 sysFiles 必须是数组');
  }
  const defaults = createDefaultServer();
  return {
    ...defaults,
    ...value,
    cpu: { ...defaults.cpu, ...(value?.cpu ?? {}) },
    mem: { ...defaults.mem, ...(value?.mem ?? {}) },
    jvm: { ...defaults.jvm, ...(value?.jvm ?? {}) },
    sys: { ...defaults.sys, ...(value?.sys ?? {}) },
    sysFiles: value.sysFiles.map((item) => ({
      dirName: item.dirName ?? '',
      sysTypeName: item.sysTypeName ?? '',
      typeName: item.typeName ?? '',
      total: item.total ?? '',
      free: item.free ?? '',
      used: item.used ?? '',
      usage: item.usage ?? 0
    }))
  };
};

const displayText = (value?: string | null) => value || '-';

const formatPercent = (value?: number | null) => `${Number(value ?? 0).toFixed(2)}%`;

const buildProgressStatus = (value?: number | null) => ((value ?? 0) >= 80 ? 'exception' : 'success');

export default function ServerPage() {
  const [server, setServer] = useState<ServerMonitorVO>(createDefaultServer);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadServer = async () => {
      modal.loading('正在加载服务监控数据，请稍候！');
      setErrorMessage('');
      try {
        const response = await getServer();
        setServer(normalizeServer(response.data));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '加载服务监控数据失败');
      } finally {
        modal.closeLoading();
      }
    };

    loadServer();
  }, []);

  const diskColumns = useMemo<ColumnsType<ServerSysFile>>(
    () => [
      { title: '盘符路径', dataIndex: 'dirName', key: 'dirName', width: 140 },
      { title: '文件系统', dataIndex: 'sysTypeName', key: 'sysTypeName', width: 120 },
      { title: '磁盘类型', dataIndex: 'typeName', key: 'typeName', width: 140 },
      { title: '总大小', dataIndex: 'total', key: 'total', width: 120 },
      { title: '可用大小', dataIndex: 'free', key: 'free', width: 120 },
      { title: '已用大小', dataIndex: 'used', key: 'used', width: 120 },
      {
        title: '已用百分比',
        dataIndex: 'usage',
        key: 'usage',
        width: 180,
        render: (value: number) => (
          <Space orientation="vertical" size={4} style={{ width: '100%' }}>
            <div style={{ color: value >= 80 ? '#cf1322' : undefined }}>{formatPercent(value)}</div>
            <Progress percent={value || 0} status={buildProgressStatus(value)} size="small" />
          </Space>
        )
      }
    ],
    []
  );

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}

      <Row gutter={[12, 12]}>
        <Col xs={24} xl={12}>
          <Card
            hoverable
            title={
              <Space size={8}>
                <DashboardOutlined />
                <span>CPU</span>
              </Space>
            }
          >
            <table style={tableStyle}>
              <tbody>
                <tr>
                  <td style={labelCellStyle}>核心数</td>
                  <td style={valueCellStyle}>{server.cpu.cpuNum}</td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>用户使用率</td>
                  <td style={valueCellStyle}>{formatPercent(server.cpu.used)}</td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>系统使用率</td>
                  <td style={valueCellStyle}>{formatPercent(server.cpu.sys)}</td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>IO 等待率</td>
                  <td style={valueCellStyle}>{formatPercent(server.cpu.wait)}</td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>空闲率</td>
                  <td style={valueCellStyle}>{formatPercent(server.cpu.free)}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            hoverable
            title={
              <Space size={8}>
                <DatabaseOutlined />
                <span>内存</span>
              </Space>
            }
          >
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={labelCellStyle}>指标</th>
                  <th style={labelCellStyle}>系统内存</th>
                  <th style={labelCellStyle}>JVM</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={labelCellStyle}>总量</td>
                  <td style={valueCellStyle}>{server.mem.total} GB</td>
                  <td style={valueCellStyle}>{server.jvm.total} MB</td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>已用</td>
                  <td style={valueCellStyle}>{server.mem.used} GB</td>
                  <td style={valueCellStyle}>{server.jvm.used} MB</td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>剩余</td>
                  <td style={valueCellStyle}>{server.mem.free} GB</td>
                  <td style={valueCellStyle}>{server.jvm.free} MB</td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>使用率</td>
                  <td style={valueCellStyle}>
                    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                      <div style={{ color: server.mem.usage >= 80 ? '#cf1322' : undefined }}>{formatPercent(server.mem.usage)}</div>
                      <Progress percent={server.mem.usage || 0} status={buildProgressStatus(server.mem.usage)} size="small" />
                    </Space>
                  </td>
                  <td style={valueCellStyle}>
                    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                      <div style={{ color: server.jvm.usage >= 80 ? '#cf1322' : undefined }}>{formatPercent(server.jvm.usage)}</div>
                      <Progress percent={server.jvm.usage || 0} status={buildProgressStatus(server.jvm.usage)} size="small" />
                    </Space>
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </Col>

        <Col span={24}>
          <Card
            hoverable
            title={
              <Space size={8}>
                <DesktopOutlined />
                <span>服务器信息</span>
              </Space>
            }
          >
            <table style={tableStyle}>
              <tbody>
                <tr>
                  <td style={labelCellStyle}>操作系统</td>
                  <td style={valueCellStyle}>{displayText(server.sys.osName)}</td>
                  <td style={labelCellStyle}>系统架构</td>
                  <td style={valueCellStyle}>{displayText(server.sys.osArch)}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </Col>

        <Col span={24}>
          <Card
            hoverable
            title={
              <Space size={8}>
                <CodeOutlined />
                <span>Java 虚拟机</span>
              </Space>
            }
          >
            <table style={tableStyle}>
              <tbody>
                <tr>
                  <td style={labelCellStyle}>虚拟机名称</td>
                  <td style={valueCellStyle}>{displayText(server.jvm.name)}</td>
                  <td style={labelCellStyle}>Java 版本</td>
                  <td style={valueCellStyle}>{displayText(server.jvm.version)}</td>
                </tr>
                <tr>
                  <td style={labelCellStyle}>启动时间</td>
                  <td style={valueCellStyle}>{displayText(server.jvm.startTime)}</td>
                  <td style={labelCellStyle}>运行时长</td>
                  <td style={valueCellStyle}>{displayText(server.jvm.runTime)}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </Col>

        <Col span={24}>
          <Card
            hoverable
            title={
              <Space size={8}>
                <HddOutlined />
                <span>磁盘状态</span>
              </Space>
            }
          >
            <Table<ServerSysFile>
              rowKey={(record) => `${record.dirName}-${record.typeName}`}
              columns={diskColumns}
              dataSource={server.sysFiles}
              pagination={false}
              scroll={{ x: 960 }}
              locale={{ emptyText: <Empty description="暂无磁盘数据" /> }}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
