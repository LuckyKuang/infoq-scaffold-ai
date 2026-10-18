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
            <el-form-item label="任务状态" prop="status">
              <el-select v-model="queryParams.status" placeholder="任务状态" clearable>
                <el-option v-for="dict in sys_job_status" :key="dict.value" :label="dict.label" :value="dict.value" />
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
            <el-button v-hasPermi="['monitor:job:add']" type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['monitor:job:edit']" type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">
              修改
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['monitor:job:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">
              删除
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['monitor:job:export']" type="warning" plain icon="Download" @click="handleExport">导出</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" :data="jobList" border @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="任务ID" align="center" prop="jobId" width="110" />
        <el-table-column label="任务名称" align="center" prop="jobName" min-width="160" :show-overflow-tooltip="true" />
        <el-table-column label="任务分组" align="center" prop="jobGroup" width="120">
          <template #default="scope">
            <dict-tag :options="sys_job_group" :value="scope.row.jobGroup" />
          </template>
        </el-table-column>
        <el-table-column label="处理器" align="center" prop="handlerKey" min-width="160" :show-overflow-tooltip="true" />
        <el-table-column label="Cron表达式" align="center" prop="cronExpression" min-width="170" :show-overflow-tooltip="true" />
        <el-table-column label="错过策略" align="center" width="120">
          <template #default="scope">
            <dict-tag :options="sys_job_misfire_policy" :value="scope.row.misfirePolicy" />
          </template>
        </el-table-column>
        <el-table-column label="并发策略" align="center" width="120">
          <template #default="scope">
            <dict-tag :options="sys_job_concurrent" :value="scope.row.concurrent" />
          </template>
        </el-table-column>
        <el-table-column label="任务状态" align="center" width="120">
          <template #default="scope">
            <el-switch
              v-model="scope.row.status"
              active-value="0"
              inactive-value="1"
              v-hasPermi="['monitor:job:changeStatus']"
              @change="handleStatusChange(scope.row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="备注" align="center" prop="remark" min-width="150" :show-overflow-tooltip="true" />
        <el-table-column label="操作" align="center" class-name="small-padding fixed-width" width="180">
          <template #default="scope">
            <el-tooltip content="执行一次" placement="top">
              <el-button v-hasPermi="['monitor:job:run']" link type="primary" icon="VideoPlay" @click="handleRun(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['monitor:job:edit']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['monitor:job:remove']" link type="primary" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="640px" append-to-body>
      <el-form ref="jobFormRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="任务名称" prop="jobName">
          <el-input v-model="form.jobName" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="任务分组" prop="jobGroup">
          <el-select v-model="form.jobGroup" placeholder="请选择任务分组">
            <el-option v-for="dict in sys_job_group" :key="dict.value" :label="dict.label" :value="dict.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理器标识" prop="handlerKey">
          <el-select v-model="form.handlerKey" placeholder="请选择处理器">
            <el-option v-for="item in handlerOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理器参数" prop="handlerParams">
          <el-input v-model="form.handlerParams" type="textarea" :rows="4" placeholder='请输入JSON对象，例如 {"source":"manual"}' />
        </el-form-item>
        <el-form-item label="Cron表达式" prop="cronExpression">
          <el-input v-model="form.cronExpression" placeholder="例如 0 0/30 * * * ?" />
        </el-form-item>
        <el-form-item label="错过策略" prop="misfirePolicy">
          <el-radio-group v-model="form.misfirePolicy">
            <el-radio v-for="dict in sys_job_misfire_policy" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="并发策略" prop="concurrent">
          <el-radio-group v-model="form.concurrent">
            <el-radio v-for="dict in sys_job_concurrent" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="任务状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="dict in sys_job_status" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确定</el-button>
          <el-button @click="cancel">取消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Job" lang="ts">
import { addJob, changeJobStatus, delJob, getJob, listJob, listJobHandlerKeys, runJob, updateJob } from '@/api/monitor/job';
import type { JobForm, JobQuery, JobVO } from '@/api/monitor/job/types';
import { toDictRefs } from '@/utils/dict';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_job_group } = toDictRefs((proxy?.useDict('sys_job_group') ?? {}) as Record<'sys_job_group', DictDataOption[]>);
const { sys_job_status } = toDictRefs((proxy?.useDict('sys_job_status') ?? {}) as Record<'sys_job_status', DictDataOption[]>);
const { sys_job_misfire_policy } = toDictRefs((proxy?.useDict('sys_job_misfire_policy') ?? {}) as Record<'sys_job_misfire_policy', DictDataOption[]>);
const { sys_job_concurrent } = toDictRefs((proxy?.useDict('sys_job_concurrent') ?? {}) as Record<'sys_job_concurrent', DictDataOption[]>);

const loading = ref(true);
const buttonLoading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const single = ref(true);
const multiple = ref(true);
const ids = ref<Array<number | string>>([]);
const jobList = ref<JobVO[]>([]);
const handlerOptions = ref<string[]>([]);

const queryFormRef = ref<ElFormInstance>();
const jobFormRef = ref<ElFormInstance>();

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const initFormData: JobForm = {
  jobId: undefined,
  jobName: '',
  jobGroup: 'SYSTEM',
  handlerKey: '',
  handlerParams: '{}',
  cronExpression: '0 0/30 * * * ?',
  misfirePolicy: '0',
  concurrent: '1',
  status: '1',
  remark: ''
};

const data = reactive<PageData<JobForm, JobQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    jobName: '',
    jobGroup: '',
    handlerKey: '',
    status: ''
  },
  rules: {
    jobName: [{ required: true, message: '任务名称不能为空', trigger: 'blur' }],
    jobGroup: [{ required: true, message: '任务分组不能为空', trigger: 'change' }],
    handlerKey: [{ required: true, message: '处理器标识不能为空', trigger: 'change' }],
    handlerParams: [{ required: true, message: '处理器参数不能为空', trigger: 'blur' }],
    cronExpression: [{ required: true, message: 'Cron表达式不能为空', trigger: 'blur' }],
    misfirePolicy: [{ required: true, message: '错过策略不能为空', trigger: 'change' }],
    concurrent: [{ required: true, message: '并发策略不能为空', trigger: 'change' }],
    status: [{ required: true, message: '任务状态不能为空', trigger: 'change' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

const getHandlerOptions = async () => {
  try {
    const res = await listJobHandlerKeys();
    if (!Array.isArray(res.data)) {
      throw new Error('任务处理器响应 data 必须是数组');
    }
    handlerOptions.value = res.data;
    if (!form.value.handlerKey && handlerOptions.value.length > 0) {
      form.value.handlerKey = handlerOptions.value[0];
    }
  } catch (error) {
    proxy?.$modal.msgError(error instanceof Error ? error.message : '任务处理器加载失败');
  }
};

const getList = async () => {
  loading.value = true;
  const res = await listJob(queryParams.value);
  jobList.value = res.rows;
  total.value = res.total;
  loading.value = false;
};

const cancel = () => {
  reset();
  dialog.visible = false;
};

const reset = () => {
  form.value = { ...initFormData };
  jobFormRef.value?.resetFields();
  if (handlerOptions.value.length > 0) {
    form.value.handlerKey = handlerOptions.value[0];
  }
};

const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

const handleSelectionChange = (selection: JobVO[]) => {
  ids.value = selection.map((item) => item.jobId);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
};

const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '新增定时任务';
};

const handleUpdate = async (row?: JobVO) => {
  reset();
  const jobId = row?.jobId || ids.value[0];
  const res = await getJob(jobId);
  Object.assign(form.value, res.data);
  dialog.visible = true;
  dialog.title = '修改定时任务';
};

const submitForm = () => {
  jobFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    buttonLoading.value = true;
    try {
      const payload: JobForm = {
        jobId: form.value.jobId,
        jobName: form.value.jobName,
        jobGroup: form.value.jobGroup,
        handlerKey: form.value.handlerKey,
        handlerParams: form.value.handlerParams,
        cronExpression: form.value.cronExpression,
        misfirePolicy: form.value.misfirePolicy,
        concurrent: form.value.concurrent,
        status: form.value.status,
        remark: form.value.remark
      };
      if (payload.jobId) {
        await updateJob(payload);
      } else {
        await addJob(payload);
      }
      proxy?.$modal.msgSuccess('操作成功');
      dialog.visible = false;
      await getList();
    } finally {
      buttonLoading.value = false;
    }
  });
};

const handleDelete = async (row?: JobVO) => {
  const jobIds = row?.jobId || ids.value;
  await proxy?.$modal.confirm('是否确认删除任务编号为"' + jobIds + '"的数据项？');
  await delJob(jobIds);
  proxy?.$modal.msgSuccess('删除成功');
  await getList();
};

const handleExport = () => {
  proxy?.download('monitor/job/export', { ...queryParams.value }, `job_${new Date().getTime()}.xlsx`);
};

const handleStatusChange = async (row: JobVO) => {
  const text = row.status === '0' ? '启用' : '暂停';
  try {
    await proxy?.$modal.confirm('确认要' + text + '任务"' + row.jobName + '"吗？');
    await changeJobStatus(row.jobId, row.status);
    proxy?.$modal.msgSuccess(text + '成功');
  } catch (error) {
    row.status = row.status === '0' ? '1' : '0';
  }
};

const handleRun = async (row: JobVO) => {
  await proxy?.$modal.confirm('确认立即执行任务"' + row.jobName + '"一次吗？');
  await runJob(row.jobId);
  proxy?.$modal.msgSuccess('执行请求已提交');
};

onMounted(async () => {
  await getHandlerOptions();
  await getList();
});
</script>
