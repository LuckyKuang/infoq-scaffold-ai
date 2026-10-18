<template>
  <div class="p-2 monitor-data-source-page">
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" class="mb-[10px]" />

    <el-row :gutter="10" class="mb-[10px]">
      <el-col :xs="12" :md="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-label">数据源数</div>
          <div class="summary-value">{{ monitor.summary.dataSourceCount }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :md="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-label">活跃连接</div>
          <div class="summary-value">{{ monitor.summary.activeConnections }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :md="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-label">空闲连接</div>
          <div class="summary-value">{{ monitor.summary.idleConnections }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :md="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-label">等待线程</div>
          <div class="summary-value">{{ monitor.summary.threadsAwaitingConnection }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover">
      <template #header>
        <span>连接池监控</span>
      </template>

      <div v-if="monitor.items.length" class="monitor-table">
        <table>
          <thead>
            <tr>
              <th>数据源</th>
              <th>状态</th>
              <th>连接概览</th>
              <th>池容量</th>
              <th>等待线程</th>
              <th>占用率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pool in monitor.items" :key="pool.name">
              <td>
                <div class="font-semibold">{{ displayText(pool.name) }}</div>
                <div class="sub-text">{{ displayText(pool.dbType) }}</div>
              </td>
              <td>
                <el-tag :type="stateTagType(pool.state)">{{ stateLabel(pool.state) }}</el-tag>
                <div class="sub-text">{{ pool.running ? '连接池已启动' : '连接池未启动' }}</div>
              </td>
              <td>
                <div>活跃 {{ displayCount(pool.activeConnections) }}</div>
                <div>空闲 {{ displayCount(pool.idleConnections) }}</div>
                <div>总数 {{ displayCount(pool.totalConnections) }}</div>
              </td>
              <td>
                <div>最大 {{ displayCount(pool.maximumPoolSize) }}</div>
                <div>等待 {{ displayCount(pool.threadsAwaitingConnection) }}</div>
              </td>
              <td>{{ displayCount(pool.threadsAwaitingConnection) }}</td>
              <td class="usage-cell">
                <el-progress
                  :percentage="pool.usagePercent ?? 0"
                  :status="usageProgressStatus(pool.usagePercent)"
                  :stroke-width="12"
                  :show-text="false"
                />
                <div :class="dangerClass(pool.usagePercent)">{{ formatPercent(pool.usagePercent) }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <el-empty v-else description="暂无连接池数据" />
    </el-card>
  </div>
</template>

<script setup name="DataSource" lang="ts">
import { getDataSourceMonitor } from '@/api/monitor/dataSource';
import type { DataSourceMonitorSummary, DataSourceMonitorVO, DataSourcePoolVO } from '@/api/monitor/dataSource/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

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

const monitor = ref<DataSourceMonitorVO>(createDefaultMonitor());
const errorMessage = ref('');

const displayText = (value?: string | null) => value || '-';

const displayCount = (value?: number | null) => (value ?? 0).toString();

const formatPercent = (value?: number | null) => `${Number(value ?? 0).toFixed(2)}%`;

const stateLabel = (state?: string) =>
  (
    ({
      RUNNING: '运行中',
      BUSY: '繁忙',
      SATURATED: '饱和',
      UNINITIALIZED: '未初始化'
    }) as Record<string, string>
  )[state || ''] ||
  state ||
  '-';

const stateTagType = (state?: string) =>
  (
    ({
      RUNNING: 'success',
      BUSY: 'warning',
      SATURATED: 'danger',
      UNINITIALIZED: 'info'
    }) as Record<string, string>
  )[state || ''] || 'info';

const usageProgressStatus = (value?: number | null) => {
  const usage = value ?? 0;
  if (usage >= 90) {
    return 'exception';
  }
  if (usage >= 80) {
    return 'warning';
  }
  return 'success';
};

const dangerClass = (value?: number | null) => ((value ?? 0) >= 80 ? 'text-danger' : '');

const loadMonitor = async () => {
  proxy?.$modal.loading('正在加载连接池监控数据，请稍候！');
  errorMessage.value = '';
  try {
    const res = await getDataSourceMonitor();
    monitor.value = normalizeMonitor(res.data);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载连接池监控数据失败';
  } finally {
    proxy?.$modal.closeLoading();
  }
};

onMounted(() => {
  loadMonitor();
});
</script>

<style scoped lang="scss">
.summary-card {
  height: 100%;
}

.summary-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.summary-value {
  margin-top: 8px;
  color: var(--el-text-color-primary);
  font-size: 28px;
  font-weight: 700;
}

.monitor-table table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.monitor-table td,
.monitor-table th {
  padding: 12px 10px;
  border: 1px solid var(--el-border-color-lighter);
  vertical-align: top;
  word-break: break-all;
}

.monitor-table th {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.sub-text {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.usage-cell {
  min-width: 140px;
}

.text-danger {
  color: var(--el-color-danger);
  font-weight: 600;
}
</style>
