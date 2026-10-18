<template>
  <div>
    <el-table :data="devices" border style="width: 100%; height: 100%; font-size: 14px">
      <el-table-column label="设备类型" align="center">
        <template #default="scope">
          <dict-tag :options="sys_device_type" :value="scope.row.deviceType" />
        </template>
      </el-table-column>
      <el-table-column label="主机" align="center" prop="ipaddr" :show-overflow-tooltip="true" />
      <el-table-column label="登录地点" align="center" prop="loginLocation" :show-overflow-tooltip="true" />
      <el-table-column label="操作系统" align="center" prop="os" :show-overflow-tooltip="true" />
      <el-table-column label="浏览器" align="center" prop="browser" :show-overflow-tooltip="true" />
      <el-table-column label="登录时间" align="center" prop="loginTime" width="180">
        <template #default="scope">
          <span>{{ proxy.parseTime(scope.row.loginTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tooltip content="删除" placement="top">
            <el-button link type="primary" icon="Delete" @click="handldDelOnline(scope.row)"> </el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup name="Online" lang="ts">
import { delOnline } from '@/api/monitor/online';
import { toDictRefs } from '@/utils/dict';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_device_type } = toDictRefs((proxy?.useDict('sys_device_type') ?? {}) as Record<'sys_device_type', DictDataOption[]>);

const props = defineProps<{
  devices: Array<Record<string, unknown>>;
}>();
const devices = computed<Array<Record<string, unknown>>>(() => props.devices);

/** 删除按钮操作 */
const handldDelOnline = async (row: { tokenId: string | number }) => {
  try {
    await ElMessageBox.confirm('删除设备后，在该设备登录需要重新进行验证');
    const res = await delOnline(row.tokenId);
    if (res.code === 200) {
      proxy?.$modal.msgSuccess('删除成功');
      proxy?.$tab.refreshPage();
    } else {
      proxy?.$modal.msgError(res.msg);
    }
  } catch {}
};
</script>
