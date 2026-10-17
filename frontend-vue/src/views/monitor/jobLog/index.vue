<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="任务名称" prop="jobName">
              <el-input v-model="queryParams.jobName" placeholder="请输入任务名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="任务分组" prop="jobGroup">
              <el-select v-model="queryParams.jobGroup" placeholder="任务分组" clearable>
                <el-option v-for="dict in sys_job_group" :key="dict.value" :label="dict.label" :value="dict.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="执行状态" prop="status">
              <el-select v-model="queryParams.status" placeholder="执行状态" clearable>
                <el-option v-for="dict in sys_common_status" :key="dict.value" :label="dict.label" :value="dict.value" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </transition>

    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10" class="mb8">
          <el-col :span="1.5">
            <el-button v-hasPermi="['monitor:jobLog:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">
              删除
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['monitor:jobLog:remove']" type="danger" plain icon="Delete" @click="handleClean">清空</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['monitor:jobLog:export']" type="warning" plain icon="Download" @click="handleExport">导出</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" :data="jobLogList" border @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="日志ID" align="center" prop="jobLogId" width="120" />
        <el-table-column label="任务名称" align="center" prop="jobName" min-width="160" :show-overflow-tooltip="true" />
        <el-table-column label="任务分组" align="center" width="120">
          <template #default="scope">
            <dict-tag :options="sys_job_group" :value="scope.row.jobGroup" />
          </template>
        </el-table-column>
        <el-table-column label="处理器" align="center" prop="handlerKey" min-width="150" :show-overflow-tooltip="true" />
        <el-table-column label="触发来源" align="center" prop="triggerSource" width="110" />
        <el-table-column label="执行状态" align="center" width="110">
          <template #default="scope">
            <dict-tag :options="sys_common_status" :value="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column label="耗时(毫秒)" align="center" prop="durationMs" width="120" />
        <el-table-column label="开始时间" align="center" prop="startTime" width="170" />
        <el-table-column label="结束时间" align="center" prop="endTime" width="170" />
        <el-table-column label="执行消息" align="center" prop="jobMessage" min-width="200" :show-overflow-tooltip="true" />
        <el-table-column label="异常信息" align="center" prop="exceptionInfo" min-width="220" :show-overflow-tooltip="true" />
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>
  </div>
</template>

<script setup name="JobLog" lang="ts">
import { cleanJobLog, delJobLog, listJobLog } from '@/api/monitor/jobLog';
import type { JobLogQuery, JobLogVO } from '@/api/monitor/jobLog/types';
import { toDictRefs } from '@/utils/dict';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_common_status } = toDictRefs((proxy?.useDict('sys_common_status') ?? {}) as Record<'sys_common_status', DictDataOption[]>);
const { sys_job_group } = toDictRefs((proxy?.useDict('sys_job_group') ?? {}) as Record<'sys_job_group', DictDataOption[]>);

const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const multiple = ref(true);
const ids = ref<Array<number | string>>([]);
const jobLogList = ref<JobLogVO[]>([]);

const queryFormRef = ref<ElFormInstance>();

const queryParams = ref<JobLogQuery>({
  pageNum: 1,
  pageSize: 10,
  jobName: '',
  jobGroup: '',
  handlerKey: '',
  triggerSource: '',
  status: ''
});

const getList = async () => {
  loading.value = true;
  const res = await listJobLog(queryParams.value);
  jobLogList.value = res.rows;
  total.value = res.total;
  loading.value = false;
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

const handleSelectionChange = (selection: JobLogVO[]) => {
  ids.value = selection.map((item) => item.jobLogId);
  multiple.value = !selection.length;
};

const handleDelete = async (row?: JobLogVO) => {
  const jobLogIds = row?.jobLogId || ids.value;
  await proxy?.$modal.confirm('是否确认删除任务日志编号为"' + jobLogIds + '"的数据项？');
  await delJobLog(jobLogIds);
  proxy?.$modal.msgSuccess('删除成功');
  await getList();
};

const handleClean = async () => {
  await proxy?.$modal.confirm('是否确认清空所有任务日志数据项？');
  await cleanJobLog();
  proxy?.$modal.msgSuccess('清空成功');
  await getList();
};

const handleExport = () => {
  proxy?.download('monitor/jobLog/export', { ...queryParams.value }, `jobLog_${new Date().getTime()}.xlsx`);
};

onMounted(() => {
  getList();
});
</script>
