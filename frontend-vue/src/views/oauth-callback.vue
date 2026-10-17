<template>
  <div class="oauth-callback">
    <el-card class="oauth-callback-card">
      <el-result v-if="errorMessage" icon="error" :title="proxy.$t('oauthCallback.failedTitle')" :sub-title="errorMessage">
        <template #extra>
          <router-link class="link-type" to="/login">{{ proxy.$t('oauthCallback.backToLogin') }}</router-link>
        </template>
      </el-result>
      <div v-else class="oauth-callback-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ proxy.$t('oauthCallback.processing') }}</span>
      </div>
    </el-card>
    <div class="el-login-footer">
      <span>Copyright © 2018-2026 Pontus All Rights Reserved.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue';
import { useUserStore } from '@/store/modules/user';
import { useI18n } from 'vue-i18n';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { t } = useI18n();
const errorMessage = ref('');

const normalizeRedirect = (redirect: unknown) => {
  const value = typeof redirect === 'string' ? redirect : '/index';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.includes('\\')) {
      return decoded;
    }
  } catch {
    // fall through to default
  }
  return '/index';
};

onMounted(async () => {
  const error = route.query.error;
  const loginTicket = route.query.loginTicket;
  if (typeof error === 'string' && error) {
    errorMessage.value = typeof route.query.message === 'string' ? route.query.message : t('oauthCallback.failed');
    return;
  }
  if (typeof loginTicket !== 'string' || !loginTicket) {
    errorMessage.value = t('oauthCallback.missingTicket');
    return;
  }
  try {
    await userStore.loginByOAuthTicket(loginTicket);
    await router.replace(normalizeRedirect(route.query.redirect));
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('oauthCallback.failed');
  }
});
</script>

<style lang="scss" scoped>
.oauth-callback {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  background-image: url('../assets/images/login-background.jpg');
  background-size: cover;
}

.oauth-callback-card {
  width: min(420px, calc(100vw - 32px));
}

.oauth-callback-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 120px;
  color: var(--el-text-color-regular);
}

.el-login-footer {
  height: 40px;
  line-height: 40px;
  position: fixed;
  bottom: 0;
  width: 100%;
  text-align: center;
  color: #fff;
  font-family: Arial, serif;
  font-size: 12px;
  letter-spacing: 1px;
}
</style>
