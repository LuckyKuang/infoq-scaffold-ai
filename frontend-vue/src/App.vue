<template>
  <el-config-provider :locale="appStore.locale" :size="validSize">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from '@/store/modules/settings';
import { handleThemeStyle } from '@/utils/theme';
import { useAppStore } from '@/store/modules/app';

const appStore = useAppStore();

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
