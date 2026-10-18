<template>
  <div class="p-2 monitor-server-page">
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" class="mb-[10px]" />

    <el-row :gutter="10">
      <el-col :xs="24" :lg="12" class="card-box">
        <el-card shadow="hover">
          <template #header>
            <span>CPU</span>
          </template>
          <div class="monitor-table">
            <table>
              <tbody>
                <tr>
                  <td class="label">核心数</td>
                  <td>{{ server.cpu.cpuNum }}</td>
                </tr>
                <tr>
                  <td class="label">用户使用率</td>
                  <td>{{ formatPercent(server.cpu.used) }}</td>
                </tr>
                <tr>
                  <td class="label">系统使用率</td>
                  <td>{{ formatPercent(server.cpu.sys) }}</td>
                </tr>
                <tr>
                  <td class="label">IO 等待率</td>
                  <td>{{ formatPercent(server.cpu.wait) }}</td>
                </tr>
                <tr>
                  <td class="label">空闲率</td>
                  <td>{{ formatPercent(server.cpu.free) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="12" class="card-box">
        <el-card shadow="hover">
          <template #header>
            <span>内存</span>
          </template>
          <div class="monitor-table">
            <table>
              <thead>
                <tr>
                  <th class="label">指标</th>
                  <th>系统内存</th>
                  <th>JVM</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="label">总量</td>
                  <td>{{ server.mem.total }} GB</td>
                  <td>{{ server.jvm.total }} MB</td>
                </tr>
                <tr>
                  <td class="label">已用</td>
                  <td>{{ server.mem.used }} GB</td>
                  <td>{{ server.jvm.used }} MB</td>
                </tr>
                <tr>
                  <td class="label">剩余</td>
                  <td>{{ server.mem.free }} GB</td>
                  <td>{{ server.jvm.free }} MB</td>
                </tr>
                <tr>
                  <td class="label">使用率</td>
                  <td :class="dangerClass(server.mem.usage)">{{ formatPercent(server.mem.usage) }}</td>
                  <td :class="dangerClass(server.jvm.usage)">{{ formatPercent(server.jvm.usage) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col :span="24" class="card-box">
        <el-card shadow="hover">
          <template #header>
            <span>服务器信息</span>
          </template>
          <div class="monitor-table">
            <table>
              <tbody>
                <tr>
                  <td class="label">操作系统</td>
                  <td>{{ displayText(server.sys.osName) }}</td>
                  <td class="label">系统架构</td>
                  <td>{{ displayText(server.sys.osArch) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col :span="24" class="card-box">
        <el-card shadow="hover">
          <template #header>
            <span>Java 虚拟机</span>
          </template>
          <div class="monitor-table">
            <table>
              <tbody>
                <tr>
                  <td class="label">虚拟机名称</td>
                  <td>{{ displayText(server.jvm.name) }}</td>
                  <td class="label">Java 版本</td>
                  <td>{{ displayText(server.jvm.version) }}</td>
                </tr>
                <tr>
                  <td class="label">启动时间</td>
                  <td>{{ displayText(server.jvm.startTime) }}</td>
                  <td class="label">运行时长</td>
                  <td>{{ displayText(server.jvm.runTime) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col :span="24" class="card-box">
        <el-card shadow="hover">
          <template #header>
            <span>磁盘状态</span>
          </template>
          <div v-if="server.sysFiles.length" class="monitor-table">
            <table>
              <thead>
                <tr>
                  <th>盘符路径</th>
                  <th>文件系统</th>
                  <th>磁盘类型</th>
                  <th>总大小</th>
                  <th>可用大小</th>
                  <th>已用大小</th>
                  <th>已用百分比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sysFile in server.sysFiles" :key="`${sysFile.dirName}-${sysFile.typeName}`">
                  <td>{{ displayText(sysFile.dirName) }}</td>
                  <td>{{ displayText(sysFile.sysTypeName) }}</td>
                  <td>{{ displayText(sysFile.typeName) }}</td>
                  <td>{{ displayText(sysFile.total) }}</td>
                  <td>{{ displayText(sysFile.free) }}</td>
                  <td>{{ displayText(sysFile.used) }}</td>
                  <td :class="dangerClass(sysFile.usage)">{{ formatPercent(sysFile.usage) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <el-empty v-else description="暂无磁盘数据" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Server" lang="ts">
import { getServer } from '@/api/monitor/server';
import type { ServerCpu, ServerJvm, ServerMem, ServerMonitorVO, ServerSys, ServerSysFile } from '@/api/monitor/server/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

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
    sysFiles: value.sysFiles.map((item: Partial<ServerSysFile>) => ({
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

const server = ref<ServerMonitorVO>(createDefaultServer());
const errorMessage = ref('');

const formatPercent = (value?: number | null) => `${Number(value ?? 0).toFixed(2)}%`;

const displayText = (value?: string | null) => value || '-';

const dangerClass = (value?: number | null) => ((value ?? 0) >= 80 ? 'text-danger' : '');

const loadServer = async () => {
  proxy?.$modal.loading('正在加载服务监控数据，请稍候！');
  errorMessage.value = '';
  try {
    const res = await getServer();
    server.value = normalizeServer(res.data);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载服务监控数据失败';
  } finally {
    proxy?.$modal.closeLoading();
  }
};

onMounted(() => {
  loadServer();
});
</script>

<style scoped lang="scss">
.card-box {
  margin-bottom: 10px;
}

.monitor-table table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.monitor-table td,
.monitor-table th {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  vertical-align: top;
  word-break: break-all;
}

.monitor-table th,
.monitor-table .label {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.text-danger {
  color: var(--el-color-danger);
  font-weight: 600;
}
</style>
