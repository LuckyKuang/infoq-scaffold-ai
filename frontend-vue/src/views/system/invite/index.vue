<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="search">
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" label-width="90px">
          <el-form-item label="邀请码" prop="inviteCode">
            <el-input v-model="queryParams.inviteCode" placeholder="请输入邀请码" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="总状态" prop="status">
            <el-select v-model="queryParams.status" placeholder="请选择状态" clearable>
              <el-option v-for="dict in sys_invite_code_status" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="使用人邮箱" prop="usedUserEmail">
            <el-input v-model="queryParams.usedUserEmail" placeholder="请输入使用人邮箱" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="生成人" prop="creatorName">
            <el-input v-model="queryParams.creatorName" placeholder="请输入生成人" clearable @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="生成时间" style="width: 360px">
            <el-date-picker
              v-model="dateRange"
              value-format="YYYY-MM-DD HH:mm:ss"
              type="daterange"
              range-separator="-"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </transition>

    <el-card shadow="never">
      <template #header>
        <el-row :gutter="10" class="mb8">
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:invite:add']" type="primary" plain icon="Plus" @click="handleOpenGenerate">生成邀请码</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:invite:edit']" type="warning" plain icon="CircleClose" :disabled="single" @click="handleOpenCancel()">
              作废
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:invite:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">
              删除
            </el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:invite:export']" type="warning" plain icon="Download" @click="handleExport">导出</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
        </el-row>
      </template>

      <el-table v-loading="loading" :data="inviteList" border @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="邀请码" min-width="250" align="center">
          <template #default="scope">
            <div class="invite-code-cell">
              <span class="invite-code-text">{{ scope.row.inviteCode }}</span>
              <el-button link type="primary" icon="DocumentCopy" @click="handleCopy(scope.row.inviteCode)">复制</el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="总状态" align="center" prop="status" width="120">
          <template #default="scope">
            <dict-tag :options="sys_invite_code_status" :value="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column label="使用人邮箱" align="center" prop="usedUserEmail" min-width="180" :show-overflow-tooltip="true" />
        <el-table-column label="生成人" align="center" prop="creatorName" width="140" :show-overflow-tooltip="true" />
        <el-table-column label="生成时间" align="center" prop="createTime" width="180">
          <template #default="scope">
            <span>{{ proxy?.parseTime(scope.row.createTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="过期时间" align="center" prop="expireTime" width="180">
          <template #default="scope">
            <span>{{ proxy?.parseTime(scope.row.expireTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用时间" align="center" prop="usedTime" width="180">
          <template #default="scope">
            <span>{{ proxy?.parseTime(scope.row.usedTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="作废时间" align="center" prop="canceledTime" width="180">
          <template #default="scope">
            <span>{{ proxy?.parseTime(scope.row.canceledTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" align="center" prop="remark" min-width="180" :show-overflow-tooltip="true" />
        <el-table-column label="作废原因" align="center" prop="canceledReason" min-width="180" :show-overflow-tooltip="true" />
        <el-table-column label="操作" align="center" width="180" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="作废" placement="top">
              <el-button
                v-hasPermi="['system:invite:edit']"
                link
                type="primary"
                icon="CircleClose"
                :disabled="!canCancel(scope.row)"
                @click="handleOpenCancel(scope.row)"
              />
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button
                v-hasPermi="['system:invite:remove']"
                link
                type="primary"
                icon="Delete"
                :disabled="!canDelete(scope.row)"
                @click="handleDelete(scope.row)"
              />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <el-dialog v-model="generateDialog.visible" :title="generateDialog.title" width="520px" append-to-body>
      <el-form ref="generateFormRef" :model="generateForm" :rules="generateRules" label-width="100px">
        <el-form-item label="生成数量" prop="generateCount">
          <el-input-number v-model="generateForm.generateCount" :min="1" :max="100" :step="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="永久有效">
          <el-switch v-model="generateForm.permanent" />
        </el-form-item>
        <el-form-item v-if="!generateForm.permanent" label="过期时间" prop="expireTime">
          <el-date-picker v-model="generateForm.expireTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="请选择过期时间" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="generateForm.remark" type="textarea" :rows="4" maxlength="255" show-word-limit placeholder="请输入用途备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitGenerateForm">确定</el-button>
          <el-button @click="closeGenerateDialog">取消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="cancelDialog.visible" :title="cancelDialog.title" width="520px" append-to-body>
      <el-form ref="cancelFormRef" :model="cancelForm" :rules="cancelRules" label-width="100px">
        <el-form-item label="作废原因" prop="canceledReason">
          <el-input v-model="cancelForm.canceledReason" type="textarea" :rows="4" maxlength="255" show-word-limit placeholder="请输入作废原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitCancelForm">确定</el-button>
          <el-button @click="closeCancelDialog">取消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Invite" lang="ts">
import { cancelInvite, delInvite, generateInvite, listInvite } from '@/api/system/invite';
import type { InviteCodeCancelForm, InviteCodeGenerateForm, InviteCodeQuery, InviteCodeVO } from '@/api/system/invite/types';
import { toDictRefs } from '@/utils/dict';

interface InviteGenerateViewForm extends InviteCodeGenerateForm {
  permanent: boolean;
}

interface InviteCancelViewForm {
  inviteId?: number | string;
  canceledReason: string;
}

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_invite_code_status } = toDictRefs((proxy?.useDict('sys_invite_code_status') ?? {}) as Record<'sys_invite_code_status', DictDataOption[]>);

const inviteList = ref<InviteCodeVO[]>([]);
const selectedRows = ref<InviteCodeVO[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const dateRange = ref<[DateModelType, DateModelType]>(['', '']);

const queryFormRef = ref<ElFormInstance>();
const generateFormRef = ref<ElFormInstance>();
const cancelFormRef = ref<ElFormInstance>();

const generateDialog = reactive<DialogOption>({
  visible: false,
  title: '生成邀请码'
});

const cancelDialog = reactive<DialogOption>({
  visible: false,
  title: '作废邀请码'
});

const queryParams = reactive<InviteCodeQuery>({
  pageNum: 1,
  pageSize: 10,
  inviteCode: '',
  status: '',
  usedUserEmail: '',
  creatorName: ''
});

const initGenerateFormData: InviteGenerateViewForm = {
  generateCount: 1,
  expireTime: undefined,
  remark: '',
  permanent: true
};

const initCancelFormData: InviteCancelViewForm = {
  inviteId: undefined,
  canceledReason: ''
};

const generateForm = reactive<InviteGenerateViewForm>({ ...initGenerateFormData });
const cancelForm = reactive<InviteCancelViewForm>({ ...initCancelFormData });

const generateRules: ElFormRules<InviteGenerateViewForm> = {
  generateCount: [{ required: true, message: '生成数量不能为空', trigger: 'blur' }],
  expireTime: [
    {
      validator: (_rule, value, callback) => {
        if (!generateForm.permanent && !value) {
          callback(new Error('请选择过期时间'));
          return;
        }
        callback();
      },
      trigger: 'change'
    }
  ]
};

const cancelRules: ElFormRules<InviteCancelViewForm> = {
  canceledReason: [{ required: true, message: '作废原因不能为空', trigger: 'blur' }]
};

const canCancel = (row: InviteCodeVO) => row.status === '0';
const canDelete = (row: InviteCodeVO) => row.status !== '1';

const getList = async () => {
  loading.value = true;
  try {
    const res = await listInvite(proxy?.addDateRange({ ...queryParams }, dateRange.value));
    inviteList.value = res.rows;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
};

const resetGenerateForm = () => {
  Object.assign(generateForm, initGenerateFormData);
  generateFormRef.value?.resetFields();
};

const resetCancelForm = () => {
  Object.assign(cancelForm, initCancelFormData);
  cancelFormRef.value?.resetFields();
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  dateRange.value = ['', ''];
  queryFormRef.value?.resetFields();
  handleQuery();
};

const handleSelectionChange = (selection: InviteCodeVO[]) => {
  selectedRows.value = selection;
  ids.value = selection.map((item) => item.inviteId);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
};

const handleOpenGenerate = () => {
  resetGenerateForm();
  generateDialog.visible = true;
};

const closeGenerateDialog = () => {
  generateDialog.visible = false;
  resetGenerateForm();
};

const submitGenerateForm = () => {
  generateFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    await generateInvite({
      generateCount: generateForm.generateCount,
      expireTime: generateForm.permanent ? undefined : generateForm.expireTime,
      remark: generateForm.remark
    });
    proxy?.$modal.msgSuccess('生成成功');
    closeGenerateDialog();
    await getList();
  });
};

const resolveCancelRow = (row?: InviteCodeVO) => {
  const target = row ?? selectedRows.value[0];
  if (!target) {
    proxy?.$modal.msgWarning('请选择需要作废的邀请码');
    return undefined;
  }
  if (!canCancel(target)) {
    proxy?.$modal.msgWarning('仅未使用的邀请码允许作废');
    return undefined;
  }
  return target;
};

const handleOpenCancel = (row?: InviteCodeVO) => {
  const target = resolveCancelRow(row);
  if (!target) {
    return;
  }
  resetCancelForm();
  cancelForm.inviteId = target.inviteId;
  cancelDialog.visible = true;
};

const closeCancelDialog = () => {
  cancelDialog.visible = false;
  resetCancelForm();
};

const submitCancelForm = () => {
  cancelFormRef.value?.validate(async (valid: boolean) => {
    if (!valid || cancelForm.inviteId == null) {
      return;
    }
    await cancelInvite({
      inviteId: cancelForm.inviteId,
      canceledReason: cancelForm.canceledReason
    } as InviteCodeCancelForm);
    proxy?.$modal.msgSuccess('作废成功');
    closeCancelDialog();
    await getList();
  });
};

const handleDelete = async (row?: InviteCodeVO) => {
  const targetRows = row ? [row] : selectedRows.value;
  if (!targetRows.length) {
    proxy?.$modal.msgWarning('请选择需要删除的邀请码');
    return;
  }
  if (targetRows.some((item) => !canDelete(item))) {
    proxy?.$modal.msgWarning('已使用的邀请码不允许删除');
    return;
  }
  const targetIds = row ? row.inviteId : ids.value;
  const codeText = targetRows.map((item) => item.inviteCode).join('、');
  await proxy?.$modal.confirm('是否确认删除邀请码 "' + codeText + '" ?');
  await delInvite(targetIds);
  proxy?.$modal.msgSuccess('删除成功');
  await getList();
};

const handleExport = () => {
  proxy?.download('system/invite/export', proxy?.addDateRange({ ...queryParams }, dateRange.value), `invite_${new Date().getTime()}.xlsx`);
};

const handleCopy = async (inviteCode: string) => {
  const textArea = document.createElement('textarea');
  textArea.value = inviteCode;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
  proxy?.$modal.msgSuccess('邀请码已复制');
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.invite-code-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.invite-code-text {
  font-family: Consolas, Monaco, monospace;
  word-break: break-all;
}
</style>
