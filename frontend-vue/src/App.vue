<template>
  <el-config-provider :locale="appStore.locale" :size="validSize">
    <el-result v-if="userStore.bootstrapState === 'failed'" icon="error" title="会话恢复失败" :sub-title="userStore.bootstrapError">
      <template #extra>
        <el-button type="primary" @click="reloadSession">重试</el-button>
      </template>
    </el-result>
    <div v-else-if="userStore.bootstrapState === 'restoring'" v-loading="true" style="min-height: 100vh" aria-label="正在恢复会话" />
    <el-result
      v-else-if="userStore.bootstrapState === 'anonymous' && !isPublicRoute(route.path)"
      icon="warning"
      title="会话已结束"
      sub-title="请重新登录"
    >
      <template #extra>
        <el-button type="primary" @click="reloadSession">重新登录</el-button>
      </template>
    </el-result>
    <router-view v-else />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from '@/store/modules/settings';
import { handleThemeStyle } from '@/utils/theme';
import { useAppStore } from '@/store/modules/app';
import { useUserStore } from '@/store/modules/user';
import { isPublicRoute } from '@/router/public-routes';

const appStore = useAppStore();
const userStore = useUserStore();
const route = useRoute();
const reloadSession = () => window.location.reload();

const validSize = computed(() => {
  const size = appStore.size;
  return ['large', 'default', 'small'].includes(size as string) ? size : 'default';
});

onMounted(() => {
  nextTick(() => {
    // 初始化主题样式
    handleThemeStyle(useSettingsStore().theme);
  });
});
</script>
