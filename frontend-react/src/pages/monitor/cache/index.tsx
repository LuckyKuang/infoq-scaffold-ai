import { useEffect, useRef, useState } from 'react';
import { DashboardOutlined, FundOutlined, PieChartOutlined } from '@ant-design/icons';
import { Card, Col, Row, Space } from 'antd';
import { getCache } from '@/api/monitor/cache';
import type { CacheVO } from '@/api/monitor/cache/types';
import echarts from '@/utils/echarts';
import modal from '@/utils/modal';

const defaultCache: CacheVO = {
  commandStats: [],
  dbSize: 0,
  info: {}
};

export default function CachePage() {
  const [cache, setCache] = useState<CacheVO>(defaultCache);
  const commandChartRef = useRef<HTMLDivElement | null>(null);
  const memoryChartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadCache = async () => {
      modal.loading('正在加载缓存监控数据，请稍候！');
      try {
        const response = await getCache();
        setCache(response.data);
      } finally {
        modal.closeLoading();
      }
    };

    loadCache();
  }, []);

  useEffect(() => {
    const commandChartElement = commandChartRef.current;
    const memoryChartElement = memoryChartRef.current;

    if (!commandChartElement || !memoryChartElement || (!cache.commandStats.length && !cache.info.used_memory_human)) {
      return undefined;
    }

    let commandChartInstance: ReturnType<typeof echarts.init> | undefined;
    let memoryChartInstance: ReturnType<typeof echarts.init> | undefined;
    let lastCommandChartSize = { width: 0, height: 0 };
    let lastMemoryChartSize = { width: 0, height: 0 };
    const memoryLabel = cache.info.used_memory_human || '0';

    const handleResize = () => {
      commandChartInstance?.resize();
      memoryChartInstance?.resize();
    };

    const readChartSizes = () => ({
      command: {
        width: commandChartElement.clientWidth,
        height: commandChartElement.clientHeight
      },
      memory: {
        width: memoryChartElement.clientWidth,
        height: memoryChartElement.clientHeight
      }
    });

    const hasValidChartSize = (size: { width: number; height: number }) => size.width > 0 && size.height > 0;

    const initializeCharts = () => {
      const chartSizes = readChartSizes();
      if (!hasValidChartSize(chartSizes.command) || !hasValidChartSize(chartSizes.memory)) {
        return;
      }
      if (!commandChartInstance) {
        commandChartInstance = echarts.init(commandChartElement, 'macarons');
        commandChartInstance.setOption({
          tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b} : {c} ({d}%)'
          },
          series: [
            {
              name: '命令',
              type: 'pie',
              roseType: 'radius',
              radius: [15, 95],
              center: ['50%', '38%'],
              data: cache.commandStats,
              animationEasing: 'cubicInOut',
              animationDuration: 1000
            }
          ]
        });
      }

      if (!memoryChartInstance) {
        memoryChartInstance = echarts.init(memoryChartElement, 'macarons');
        memoryChartInstance.setOption({
          tooltip: {
            formatter: `{b} <br/>{a} : ${memoryLabel}`
          },
          series: [
            {
              name: '峰值',
              type: 'gauge',
              min: 0,
              max: 1000,
              detail: {
                formatter: memoryLabel
              },
              data: [
                {
                  value: Number.parseFloat(memoryLabel) || 0,
                  name: '内存消耗'
                }
              ]
            }
          ]
        });
      }

      lastCommandChartSize = chartSizes.command;
      lastMemoryChartSize = chartSizes.memory;
    };

    const resizeObserver = new ResizeObserver(() => {
      const chartSizes = readChartSizes();
      if (!commandChartInstance || !memoryChartInstance) {
        initializeCharts();
        return;
      }

      const commandSizeChanged =
        chartSizes.command.width !== lastCommandChartSize.width || chartSizes.command.height !== lastCommandChartSize.height;
      const memorySizeChanged =
        chartSizes.memory.width !== lastMemoryChartSize.width || chartSizes.memory.height !== lastMemoryChartSize.height;

      lastCommandChartSize = chartSizes.command;
      lastMemoryChartSize = chartSizes.memory;

      if (!hasValidChartSize(chartSizes.command) || !hasValidChartSize(chartSizes.memory)) {
        return;
      }

      if (commandSizeChanged || memorySizeChanged) {
        handleResize();
      }
    });

    resizeObserver.observe(commandChartElement);
    resizeObserver.observe(memoryChartElement);
    initializeCharts();

    return () => {
      resizeObserver.disconnect();
      commandChartInstance?.dispose();
      memoryChartInstance?.dispose();
    };
  }, [cache.commandStats, cache.info.used_memory_human]);

  const cpuUsage =
    cache.info.used_cpu_user_children !== undefined ? Number.parseFloat(cache.info.used_cpu_user_children).toFixed(2) : '-';
  const redisMode = cache.info.redis_mode === undefined ? '-' : cache.info.redis_mode === 'standalone' ? '单机' : '集群';
  const aofEnabled =
    cache.info.aof_enabled === undefined ? '-' : cache.info.aof_enabled === '0' ? '否' : '是';
  const networkIO =
    cache.info.instantaneous_input_kbps !== undefined && cache.info.instantaneous_output_kbps !== undefined
      ? `${cache.info.instantaneous_input_kbps}kps/${cache.info.instantaneous_output_kbps}kps`
      : '-';

  return (
    <div className="cache-monitor-page">
      <Row gutter={[10, 10]}>
        <Col span={24} className="card-box">
          <Card
            hoverable
            title={
              <Space size={8}>
                <DashboardOutlined />
                <span>基本信息</span>
              </Space>
            }
          >
            <div className="cache-basic-table">
              <table>
                <tbody>
                  <tr>
                    <td className="label">Redis版本</td>
                    <td>{cache.info.redis_version || '-'}</td>
                    <td className="label">运行模式</td>
                    <td>{redisMode}</td>
                    <td className="label">端口</td>
                    <td>{cache.info.tcp_port || '-'}</td>
                    <td className="label">客户端数</td>
                    <td>{cache.info.connected_clients || '-'}</td>
                  </tr>
                  <tr>
                    <td className="label">运行时间(天)</td>
                    <td>{cache.info.uptime_in_days || '-'}</td>
                    <td className="label">使用内存</td>
                    <td>{cache.info.used_memory_human || '-'}</td>
                    <td className="label">使用CPU</td>
                    <td>{cpuUsage}</td>
                    <td className="label">内存配置</td>
                    <td>{cache.info.maxmemory_human || '-'}</td>
                  </tr>
                  <tr>
                    <td className="label">AOF是否开启</td>
                    <td>{aofEnabled}</td>
                    <td className="label">RDB是否成功</td>
                    <td>{cache.info.rdb_last_bgsave_status || '-'}</td>
                    <td className="label">Key数量</td>
                    <td>{cache.dbSize}</td>
                    <td className="label">网络入口/出口</td>
                    <td>{networkIO}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12} className="card-box">
          <Card
            hoverable
            title={
              <Space size={8}>
                <PieChartOutlined />
                <span>命令统计</span>
              </Space>
            }
          >
            <div ref={commandChartRef} data-testid="cache-command-chart" style={{ height: 420 }} />
          </Card>
        </Col>

        <Col xs={24} md={12} className="card-box">
          <Card
            hoverable
            title={
              <Space size={8}>
                <FundOutlined />
                <span>内存信息</span>
              </Space>
            }
          >
            <div ref={memoryChartRef} data-testid="cache-memory-chart" style={{ height: 420 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
