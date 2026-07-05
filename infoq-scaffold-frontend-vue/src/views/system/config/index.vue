<template>
  <div class="config-center-page p-2">
    <el-card shadow="hover" class="config-center-hero">
      <div class="config-hero-content">
        <div>
          <h2 class="config-title">参数设置</h2>
          <div class="config-subtitle">按类型直接修改配置，恢复默认由后端读取 default_value 执行。</div>
        </div>
        <div class="config-hero-actions">
          <el-button @click="handleRefreshCache">刷新缓存</el-button>
          <el-button @click="handleExport">导出</el-button>
          <el-button v-if="isSuperAdmin" type="primary" icon="Plus" @click="openAddDrawer">管理配置定义</el-button>
        </div>
      </div>
    </el-card>

    <div class="config-center-layout">
      <el-card shadow="hover" class="config-group-nav">
        <el-button :type="activeGroupKey === 'all' ? 'primary' : 'default'" @click="activeGroupKey = 'all'">全部配置</el-button>
        <el-button
          v-for="group in panel.groups"
          :key="group.groupKey"
          :type="activeGroupKey === group.groupKey ? 'primary' : 'default'"
          @click="activeGroupKey = group.groupKey"
        >
          {{ group.groupName }} ({{ group.items.length }})
        </el-button>
      </el-card>

      <div class="config-mobile-group">
        <el-select v-model="activeGroupKey" class="w-full">
          <el-option label="全部配置" value="all" />
          <el-option v-for="group in panel.groups" :key="group.groupKey" :label="group.groupName" :value="group.groupKey" />
        </el-select>
      </div>

      <div class="config-list-panel">
        <div v-loading="loading" class="config-list-scroll">
          <div class="config-group-list">
            <el-card v-if="filteredItemTotal === 0" shadow="hover">
              <el-empty description="没有匹配的配置项" />
            </el-card>

            <section v-for="group in pagedGroups" :key="group.groupKey" class="config-group-section">
              <div class="config-section-title">
                <h3>{{ group.groupName }}</h3>
                <span>{{ group.items.length }} 项配置</span>
              </div>

              <div class="config-card-list">
                <el-card v-for="item in group.items" :key="item.configKey" shadow="hover" class="config-center-card config-setting-row">
                  <div class="config-card-main" :class="{ 'config-card-main-editing': editingKeys[item.configKey] }">
                    <div class="config-card-copy">
                      <div class="config-card-heading">
                        <strong>{{ item.configName }}</strong>
                        <el-tag size="small" :type="item.configType === 'Y' ? 'primary' : 'info'">{{
                          item.configType === 'Y' ? '系统内置' : '用户自定义'
                        }}</el-tag>
                        <el-tag size="small">{{ item.valueType }}</el-tag>
                      </div>
                      <div class="config-card-key">{{ item.configKey }}</div>
                      <div v-if="item.remark" class="config-card-desc">{{ item.remark }}</div>
                      <div v-if="!item.editable" class="config-card-warning">{{ item.editableReason || '该配置不可编辑' }}</div>
                    </div>

                    <div class="config-card-control">
                      <el-switch
                        v-if="item.valueType === 'switch'"
                        :model-value="item.configValue === 'true'"
                        :disabled="!item.editable || savingKeys[item.configKey]"
                        :loading="savingKeys[item.configKey]"
                        active-text="开启"
                        inactive-text="关闭"
                        @change="(value) => saveItemValue(item, Boolean(value))"
                      />

                      <el-select
                        v-else-if="item.valueType === 'select'"
                        :model-value="item.configValue"
                        :disabled="!item.editable || savingKeys[item.configKey]"
                        :loading="savingKeys[item.configKey]"
                        class="config-value-select"
                        @change="(value) => saveItemValue(item, String(value))"
                      >
                        <el-option v-for="option in item.options || []" :key="option.value" :label="option.label" :value="option.value" />
                      </el-select>

                      <template v-else-if="item.valueType === 'text' || item.valueType === 'password'">
                        <div v-if="editingKeys[item.configKey]" class="config-edit-row">
                          <el-input
                            v-model="editingValues[item.configKey]"
                            :type="item.valueType === 'password' ? 'password' : 'text'"
                            :show-password="item.valueType === 'password'"
                            :disabled="savingKeys[item.configKey]"
                            @keyup.enter="submitTextEdit(item)"
                          />
                          <el-button type="primary" icon="Check" :loading="savingKeys[item.configKey]" @click="submitTextEdit(item)">保存</el-button>
                          <el-button @click="cancelEdit(item)">取消</el-button>
                        </div>
                        <div v-else class="config-edit-row">
                          <code>{{ item.valueType === 'password' ? maskValue(item.configValue) : item.configValue || '未设置' }}</code>
                          <el-button icon="Edit" :disabled="!item.editable" @click="startEdit(item)">编辑</el-button>
                        </div>
                      </template>

                      <el-tag v-else type="info">{{ item.valueType || 'text' }} 类型暂不支持面板编辑</el-tag>
                    </div>
                  </div>

                  <div class="config-card-footer">
                    <span>默认值：{{ formatDefaultValue(item) }}</span>
                    <div class="config-card-actions">
                      <template v-if="isSuperAdmin">
                        <el-button link type="primary" icon="Setting" @click="openEditDrawer(item)">定义</el-button>
                        <el-button link type="danger" icon="Delete" :disabled="item.configType === 'Y'" @click="deleteDefinition(item)">
                          删除
                        </el-button>
                      </template>
                      <el-button
                        icon="Refresh"
                        :disabled="!item.editable || !hasDefaultValue(item)"
                        :loading="savingKeys[item.configKey]"
                        @click="restoreDefault(item)"
                      >
                        恢复默认
                      </el-button>
                    </div>
                  </div>
                </el-card>
              </div>
            </section>
          </div>
        </div>
        <pagination
          v-show="filteredItemTotal > 0"
          v-model:page="listPage"
          v-model:limit="listPageSize"
          :total="filteredItemTotal"
          :auto-scroll="false"
          class="config-list-pagination"
        />
      </div>
    </div>

    <el-drawer v-model="drawerOpen" title="配置定义管理" size="720px" destroy-on-close>
      <el-tabs>
        <el-tab-pane label="新增 / 编辑">
          <el-form ref="configFormRef" :model="form" :rules="rules" label-width="110px">
            <el-form-item label="参数名称" prop="configName">
              <el-input v-model="form.configName" placeholder="例如：账号自助-是否开启用户注册功能" />
            </el-form-item>
            <el-form-item label="参数键名" prop="configKey">
              <el-input v-model="form.configKey" placeholder="例如：sys.account.registerUser" />
            </el-form-item>
            <el-form-item label="参数类型" prop="valueType">
              <el-select v-model="form.valueType" class="w-full">
                <el-option v-for="type in supportedValueTypes" :key="type.value" :label="type.label" :value="type.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="当前值" prop="configValue">
              <el-select v-if="form.valueType === 'switch'" v-model="form.configValue" class="w-full">
                <el-option label="开启 true" value="true" />
                <el-option label="关闭 false" value="false" />
              </el-select>
              <el-input
                v-else
                v-model="form.configValue"
                :type="form.valueType === 'password' ? 'password' : 'text'"
                :show-password="form.valueType === 'password'"
              />
            </el-form-item>
            <el-form-item label="默认值" prop="defaultValue">
              <el-select v-if="form.valueType === 'switch'" v-model="form.defaultValue" clearable class="w-full">
                <el-option label="开启 true" value="true" />
                <el-option label="关闭 false" value="false" />
              </el-select>
              <el-input v-else v-model="form.defaultValue" />
            </el-form-item>
            <el-form-item label="分组" prop="groupKey">
              <el-select v-model="form.groupKey" class="w-full">
                <el-option v-for="group in groupOptions" :key="group.value" :label="group.label" :value="group.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="显示顺序" prop="displayOrder">
              <el-input-number v-model="form.displayOrder" :min="0" :precision="0" class="w-full" />
            </el-form-item>
            <el-form-item v-if="form.valueType === 'select'" label="选项 JSON" prop="optionsJson">
              <el-input v-model="form.optionsJson" type="textarea" :rows="4" placeholder='[{"label":"浅色主题","value":"theme-light"}]' />
            </el-form-item>
            <el-form-item label="UI 属性 JSON" prop="uiPropsJson">
              <el-input v-model="form.uiPropsJson" type="textarea" :rows="3" placeholder='例如：{"placeholder":"请输入"}' />
            </el-form-item>
            <el-form-item label="系统内置" prop="configType">
              <el-select v-model="form.configType" class="w-full">
                <el-option label="是" value="Y" />
                <el-option label="否" value="N" />
              </el-select>
            </el-form-item>
            <el-form-item label="备注" prop="remark">
              <el-input v-model="form.remark" type="textarea" :rows="3" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="submitting" @click="submitDefinition">保存定义</el-button>
              <el-button @click="resetDefinitionForm">清空表单</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="显示顺序">
          <el-table :data="orderRows" border>
            <el-table-column label="配置项" min-width="220">
              <template #default="scope">{{ findItemName(scope.row.configId) }}</template>
            </el-table-column>
            <el-table-column label="分组" width="180">
              <template #default="scope">
                <el-select v-model="scope.row.groupKey">
                  <el-option v-for="group in groupOptions" :key="group.value" :label="group.label" :value="group.value" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="显示顺序" width="150">
              <template #default="scope">
                <el-input-number v-model="scope.row.displayOrder" :min="0" :precision="0" />
              </template>
            </el-table-column>
          </el-table>
          <div class="drawer-footer-actions">
            <el-button type="primary" :loading="submitting" @click="saveOrder">保存显示顺序</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </div>
</template>

<script setup name="Config" lang="ts">
import { useUserStore } from '@/store/modules/user';
import {
  addConfig,
  delConfig,
  getConfigPanel,
  refreshCache,
  reorderConfig,
  resetConfigByKey,
  updateConfig,
  updateConfigByKey
} from '@/api/system/config';
import type { ConfigForm, ConfigPanel, ConfigPanelGroup, ConfigPanelItem, ConfigReorderForm } from '@/api/system/config/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const userStore = useUserStore();

const supportedValueTypes = [
  { label: '开关', value: 'switch' },
  { label: '下拉选择', value: 'select' },
  { label: '文本', value: 'text' },
  { label: '密码', value: 'password' }
];

const initialFormData: ConfigForm = {
  configId: undefined,
  configName: '',
  configKey: '',
  configValue: '',
  valueType: 'text',
  defaultValue: null,
  groupKey: 'advanced',
  displayOrder: 0,
  optionsJson: null,
  uiPropsJson: null,
  configType: 'N',
  remark: ''
};

const assertConfigPanel = (value: unknown): ConfigPanel => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('配置面板响应 data 必须是对象');
  }
  if (!Array.isArray((value as ConfigPanel).groups)) {
    throw new Error('配置面板响应 data.groups 必须是数组');
  }
  return value as ConfigPanel;
};

const panel = reactive<ConfigPanel>({ groups: [] });
const loading = ref(false);
const activeGroupKey = ref('all');
const savingKeys = reactive<Record<string, boolean>>({});
const editingKeys = reactive<Record<string, boolean>>({});
const editingValues = reactive<Record<string, string>>({});
const listPage = ref(1);
const listPageSize = ref(5);
const drawerOpen = ref(false);
const submitting = ref(false);
const orderRows = ref<ConfigReorderForm[]>([]);
const configFormRef = ref<ElFormInstance>();
const form = reactive<ConfigForm>({ ...initialFormData });

const rules = {
  configName: [{ required: true, message: '参数名称不能为空', trigger: 'blur' }],
  configKey: [{ required: true, message: '参数键名不能为空', trigger: 'blur' }],
  valueType: [{ required: true, message: '参数类型不能为空', trigger: 'change' }],
  configValue: [{ required: true, message: '参数键值不能为空', trigger: 'blur' }],
  groupKey: [{ required: true, message: '配置分组不能为空', trigger: 'change' }]
};

const isSuperAdmin = computed(() => userStore.roles.includes('superadmin'));
const allItems = computed(() => panel.groups.flatMap((group) => group.items));
const groupOptions = computed(() => panel.groups.map((group) => ({ label: group.groupName, value: group.groupKey })));

const filteredGroups = computed<ConfigPanelGroup[]>(() => {
  return panel.groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        return activeGroupKey.value === 'all' || item.groupKey === activeGroupKey.value;
      })
    }))
    .filter((group) => group.items.length > 0 || activeGroupKey.value === group.groupKey);
});

const filteredItemTotal = computed(() => filteredGroups.value.reduce((total, group) => total + group.items.length, 0));

const pagedGroups = computed<ConfigPanelGroup[]>(() => {
  const start = (listPage.value - 1) * listPageSize.value;
  const end = start + listPageSize.value;
  let cursor = 0;
  return filteredGroups.value
    .map((group) => {
      const items = group.items.filter(() => {
        const included = cursor >= start && cursor < end;
        cursor += 1;
        return included;
      });
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);
});

watch([activeGroupKey], () => {
  listPage.value = 1;
});

watch([filteredItemTotal, listPageSize], () => {
  const maxPage = Math.max(1, Math.ceil(filteredItemTotal.value / listPageSize.value));
  if (listPage.value > maxPage) {
    listPage.value = maxPage;
  }
});

watch([listPage, listPageSize, activeGroupKey], () => {
  window.scrollTo({ top: 0 });
});

const loadPanel = async () => {
  loading.value = true;
  try {
    const response = await getConfigPanel();
    panel.groups = assertConfigPanel(response.data).groups;
    orderRows.value = allItems.value.map((item) => ({
      configId: item.configId,
      groupKey: item.groupKey,
      displayOrder: item.displayOrder || 0
    }));
  } catch (error) {
    proxy?.$modal.msgError(error instanceof Error ? error.message : '配置面板加载失败');
  } finally {
    loading.value = false;
  }
};

const setItemValue = (configKey: string, configValue: string) => {
  panel.groups.forEach((group) => {
    group.items.forEach((item) => {
      if (item.configKey === configKey) {
        item.configValue = configValue;
      }
    });
  });
};

const saveItemValue = async (item: ConfigPanelItem, value: string | boolean) => {
  const previous = item.configValue;
  const nextValue = typeof value === 'boolean' ? String(value) : value;
  setItemValue(item.configKey, nextValue);
  savingKeys[item.configKey] = true;
  try {
    await updateConfigByKey(item.configKey, value);
    await loadPanel();
    proxy?.$modal.msgSuccess('保存成功');
  } catch {
    setItemValue(item.configKey, previous);
  } finally {
    savingKeys[item.configKey] = false;
  }
};

const hasDefaultValue = (item: ConfigPanelItem) => item.defaultValue !== null && item.defaultValue !== undefined;

const restoreDefault = async (item: ConfigPanelItem) => {
  if (!hasDefaultValue(item)) {
    proxy?.$modal.msgWarning('该参数没有默认值');
    return;
  }
  const previous = item.configValue;
  savingKeys[item.configKey] = true;
  try {
    const response = await resetConfigByKey(item.configKey);
    setItemValue(item.configKey, response.data);
    await loadPanel();
    proxy?.$modal.msgSuccess('已恢复默认');
  } catch {
    setItemValue(item.configKey, previous);
  } finally {
    savingKeys[item.configKey] = false;
  }
};

const startEdit = (item: ConfigPanelItem) => {
  editingKeys[item.configKey] = true;
  editingValues[item.configKey] = item.configValue || '';
};

const cancelEdit = (item: ConfigPanelItem) => {
  editingKeys[item.configKey] = false;
  delete editingValues[item.configKey];
};

const submitTextEdit = async (item: ConfigPanelItem) => {
  await saveItemValue(item, editingValues[item.configKey] || '');
  cancelEdit(item);
};

const resetDefinitionForm = () => {
  Object.assign(form, { ...initialFormData });
  configFormRef.value?.resetFields();
};

const openAddDrawer = () => {
  resetDefinitionForm();
  drawerOpen.value = true;
};

const openEditDrawer = (item: ConfigPanelItem) => {
  Object.assign(form, {
    configId: item.configId,
    configName: item.configName,
    configKey: item.configKey,
    configValue: item.configValue,
    valueType: item.valueType,
    defaultValue: item.defaultValue ?? null,
    groupKey: item.groupKey,
    displayOrder: item.displayOrder || 0,
    optionsJson: item.options ? JSON.stringify(item.options) : null,
    uiPropsJson: item.uiProps && Object.keys(item.uiProps).length > 0 ? JSON.stringify(item.uiProps) : null,
    configType: item.configType,
    remark: item.remark || ''
  });
  drawerOpen.value = true;
};

const submitDefinition = () => {
  configFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    submitting.value = true;
    try {
      form.configId ? await updateConfig(form) : await addConfig(form);
      proxy?.$modal.msgSuccess('配置定义已保存');
      resetDefinitionForm();
      await loadPanel();
    } finally {
      submitting.value = false;
    }
  });
};

const deleteDefinition = async (item: ConfigPanelItem) => {
  if (item.configType === 'Y') {
    proxy?.$modal.msgWarning('内置参数不能删除');
    return;
  }
  await proxy?.$modal.confirm('是否确认删除参数键名为"' + item.configKey + '"的配置定义？');
  await delConfig(item.configId);
  proxy?.$modal.msgSuccess('删除成功');
  await loadPanel();
};

const saveOrder = async () => {
  submitting.value = true;
  try {
    await reorderConfig(orderRows.value);
    proxy?.$modal.msgSuccess('显示顺序已保存');
    await loadPanel();
  } finally {
    submitting.value = false;
  }
};

const handleRefreshCache = async () => {
  await refreshCache();
  proxy?.$modal.msgSuccess('刷新缓存成功');
};

const handleExport = () => {
  proxy?.download('system/config/export', {}, `config_${new Date().getTime()}.xlsx`);
};

const maskValue = (value?: string) => (value ? '•'.repeat(Math.min(Math.max(value.length, 6), 12)) : '未设置');
const formatDefaultValue = (item: ConfigPanelItem) => {
  if (!hasDefaultValue(item)) {
    return '无默认值';
  }
  if (item.valueType === 'password') {
    return maskValue(item.defaultValue || '');
  }
  return item.defaultValue || '空字符串';
};
const findItemName = (configId: string | number) => allItems.value.find((item) => item.configId === configId)?.configName || configId;

onMounted(() => {
  loadPanel();
});
</script>

<style lang="scss" scoped>
.config-center-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-center-hero {
  background: var(--el-bg-color-overlay);
  border-color: var(--el-border-color-light);
}

.config-hero-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.config-title {
  margin: 0 0 4px;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.config-subtitle {
  font-size: 14px;
  line-height: 22px;
  color: var(--el-text-color-secondary);
}

.config-hero-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.config-center-layout {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.config-group-nav {
  align-self: start;

  :deep(.el-card__body) {
    display: grid;
    gap: 8px;
  }

  :deep(.el-button) {
    width: 100%;
    justify-content: flex-start;
    margin-left: 0;
  }
}

.config-mobile-group {
  display: none;
}

.config-group-list,
.config-group-section,
.config-card-list {
  display: grid;
  gap: 12px;
}

.config-card-list {
  grid-template-columns: 1fr;
  gap: 10px;
}

.config-list-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.config-list-scroll {
  padding-right: 4px;
}

.config-list-pagination {
  flex: 0 0 auto;
  margin-top: 0;
  padding: 10px 0 0 !important;
}

.config-section-title,
.config-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.config-card-heading {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.config-card-heading strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 22px;
}

.config-section-title h3 {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
}

.config-section-title span,
.config-card-footer {
  color: var(--el-text-color-secondary);
}

.config-center-card {
  border-color: var(--el-border-color-light);
}

.config-setting-row {
  :deep(.el-card__body) {
    padding: 14px 16px;
  }
}

.config-card-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 420px);
  gap: 16px 24px;
  align-items: center;
}

.config-card-main-editing {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 460px);
}

.config-card-copy {
  min-width: 0;
}

.config-card-key {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.config-card-desc {
  margin-top: 6px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.6;
}

.config-card-warning {
  margin-top: 6px;
  color: var(--el-color-warning);
  font-size: 13px;
}

.config-card-control {
  display: flex;
  justify-content: flex-end;
  max-width: 100%;
  min-width: 0;
}

.config-card-main-editing .config-card-control {
  justify-content: flex-end;
  min-width: 0;
  width: 100%;
}

.config-value-select {
  min-width: 190px;
}

.config-edit-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
  max-width: 100%;
}

.config-edit-row :deep(.el-input) {
  flex: 1 1 180px;
  min-width: 0;
  max-width: 260px;
}

.config-edit-row code {
  max-width: 100%;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  word-break: break-all;
}

.config-card-footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.config-card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.drawer-footer-actions {
  margin-top: 12px;
}

@media (max-width: 900px) {
  .config-center-layout {
    display: flex;
    flex-direction: column;
  }

  .config-group-nav {
    display: none;
  }

  .config-mobile-group {
    display: block;
    margin-bottom: 12px;
    flex: 0 0 auto;
  }

  .config-card-main {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .config-card-control {
    justify-content: flex-start;
    min-width: 0;
  }

  .config-card-main-editing .config-card-control {
    justify-content: flex-start;
  }

  .config-edit-row {
    justify-content: flex-start;
  }

  .config-edit-row :deep(.el-input) {
    max-width: 100%;
  }

  .config-card-actions {
    justify-content: flex-start;
  }

  .config-card-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
