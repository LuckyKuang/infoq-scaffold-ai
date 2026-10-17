<template>
  <div class="login">
    <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="login-form">
      <div class="title-box">
        <h3 class="title">{{ title }}</h3>
        <lang-select />
      </div>
      <el-form-item prop="username">
        <el-input v-model="loginForm.username" type="text" size="large" auto-complete="off" :placeholder="proxy.$t('login.username')">
          <template #prefix><svg-icon icon-class="user" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="password">
        <el-input
          v-model="loginForm.password"
          type="password"
          size="large"
          auto-complete="off"
          :placeholder="proxy.$t('login.password')"
          @keyup.enter="handleLogin"
        >
          <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item v-if="captchaEnabled" prop="code">
        <el-input
          v-model="loginForm.code"
          size="large"
          auto-complete="off"
          :placeholder="proxy.$t('login.code')"
          style="width: 63%"
          @keyup.enter="handleLogin"
        >
          <template #prefix><svg-icon icon-class="validCode" class="el-input__icon input-icon" /></template>
        </el-input>
        <div class="login-code">
          <img :src="codeUrl" class="login-code-img" @click="getCode" />
        </div>
      </el-form-item>
      <el-checkbox v-model="loginForm.rememberMe" style="margin: 0 0 25px 0">{{ proxy.$t('login.rememberPassword') }}</el-checkbox>
      <el-form-item style="width: 100%">
        <el-button :loading="loading" size="large" type="primary" style="width: 100%" @click.prevent="handleLogin">
          <span v-if="!loading">{{ proxy.$t('login.login') }}</span>
          <span v-else>{{ proxy.$t('login.logging') }}</span>
        </el-button>
        <div v-if="register || forgotPasswordEnabled" class="auth-links">
          <router-link v-if="forgotPasswordEnabled" class="link-type" :to="'/forgot-password'">{{
            proxy.$t('login.switchForgotPasswordPage')
          }}</router-link>
          <span v-if="register && forgotPasswordEnabled" class="auth-links__divider">|</span>
          <router-link v-if="register" class="link-type" :to="'/register'">{{ proxy.$t('login.switchRegisterPage') }}</router-link>
        </div>
      </el-form-item>
      <template v-if="oauthProviders.length > 0">
        <el-divider class="oauth-divider">{{ proxy.$t('login.oauthDivider') }}</el-divider>
        <div class="oauth-buttons">
          <el-button
            v-for="provider in oauthProviders"
            :key="provider.providerCode"
            :icon="resolveOAuthIcon(provider.providerCode)"
            :loading="oauthLoadingProvider === provider.providerCode"
            class="oauth-button"
            @click.prevent="handleOAuthAuthorize(provider)"
          >
            {{ proxy.$t('login.oauthProvider', { provider: provider.providerName }) }}
          </el-button>
        </div>
      </template>
    </el-form>
    <!--  底部  -->
    <div class="el-login-footer">
      <span>Copyright © 2018-2026 Pontus All Rights Reserved.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getCodeImg, getOAuthProviders } from '@/api/login';
import { useUserStore } from '@/store/modules/user';
import { LoginData, OAuthProviderOption } from '@/api/types';
import { to } from 'await-to-js';
import { useI18n } from 'vue-i18n';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const title = import.meta.env.VITE_APP_TITLE;
const userStore = useUserStore();
const router = useRouter();
const { t } = useI18n();

const loginForm = ref<LoginData>({
  username: '',
  password: '',
  rememberMe: false,
  code: '',
  uuid: ''
} as LoginData);

const loginRules: ElFormRules = {
  username: [{ required: true, trigger: 'blur', message: t('login.rule.username.required') }],
  password: [{ required: true, trigger: 'blur', message: t('login.rule.password.required') }],
  code: [{ required: true, trigger: 'change', message: t('login.rule.code.required') }]
};

const codeUrl = ref('');
const loading = ref(false);
// 验证码开关
const captchaEnabled = ref(true);

// 注册开关
const register = ref(false);
const forgotPasswordEnabled = ref(false);
const oauthProviders = ref<OAuthProviderOption[]>([]);
const oauthLoadingProvider = ref('');
const redirect = ref('/');
const loginRef = ref<ElFormInstance>();

watch(
  () => router.currentRoute.value,
  (newRoute: RouteLocationNormalizedLoaded) => {
    const redirectQuery = newRoute.query?.redirect;
    redirect.value = typeof redirectQuery === 'string' ? decodeURIComponent(redirectQuery) : '/';
  },
  { immediate: true }
);

const handleLogin = () => {
  loginRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true;
      // 勾选了需要记住密码设置在 localStorage 中设置记住用户名和密码
      if (loginForm.value.rememberMe) {
        localStorage.setItem('username', String(loginForm.value.username));
        localStorage.setItem('password', String(loginForm.value.password));
        localStorage.setItem('rememberMe', String(loginForm.value.rememberMe));
      } else {
        // 否则移除
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        localStorage.removeItem('rememberMe');
      }
      // 调用action的登录方法
      const [err] = await to(userStore.login(loginForm.value));
      if (!err) {
        const redirectUrl = redirect.value || '/';
        await router.push(redirectUrl);
        loading.value = false;
      } else {
        loading.value = false;
        // 重新获取验证码
        if (captchaEnabled.value) {
          await getCode();
        }
      }
    }
  });
};

const handleOAuthAuthorize = (provider: OAuthProviderOption) => {
  const params = new URLSearchParams({
    clientId: import.meta.env.VITE_APP_CLIENT_ID,
    redirect: redirect.value || '/index'
  });
  oauthLoadingProvider.value = provider.providerCode;
  window.location.assign(`${import.meta.env.VITE_APP_BASE_API}/auth/oauth/${provider.providerCode}/authorize?${params.toString()}`);
};

const resolveOAuthIcon = (providerCode: string) => {
  return providerCode === 'github' ? 'Platform' : 'Connection';
};

/**
 * 获取验证码
 */
const getCode = async () => {
  const res = await getCodeImg();
  const { data } = res;
  captchaEnabled.value = data.captchaEnabled === undefined ? true : data.captchaEnabled;
  register.value = Boolean(data.registerEnabled && data.mailEnabled);
  forgotPasswordEnabled.value = Boolean(data.forgotPasswordEnabled && data.mailEnabled);
  if (captchaEnabled.value) {
    // 刷新验证码时清空输入框
    loginForm.value.code = '';
    codeUrl.value = 'data:image/gif;base64,' + data.img;
    loginForm.value.uuid = data.uuid;
  } else {
    loginForm.value.code = '';
    loginForm.value.uuid = '';
    codeUrl.value = '';
  }
};

const loadOAuthProviders = async () => {
  const [err, res] = await to(getOAuthProviders());
  oauthProviders.value = !err && Array.isArray(res?.data) ? res.data : [];
};

const getLoginData = () => {
  const username = localStorage.getItem('username');
  const password = localStorage.getItem('password');
  const rememberMe = localStorage.getItem('rememberMe');
  loginForm.value = {
    username: username === null ? String(loginForm.value.username) : username,
    password: password === null ? String(loginForm.value.password) : String(password),
    rememberMe: rememberMe === null ? false : rememberMe === 'true'
  } as LoginData;
};

onMounted(() => {
  getCode();
  loadOAuthProviders();
  getLoginData();
});
</script>

<style lang="scss" scoped>
.login {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  --login-card-bg: #ffffff;
  --login-card-border: rgb(255 255 255 / 72%);
  --login-card-shadow: 0 16px 40px rgb(0 0 0 / 14%);
  --login-card-backdrop: none;
  --login-title-color: #707070;
  --login-lang-color: #7483a3;
  --login-input-bg: var(--el-fill-color-blank);
  --login-input-border: var(--el-border-color);
  --login-input-hover-border: var(--el-border-color-hover);
  background-image: url('../assets/images/login-background.jpg');
  background-size: cover;
}

.title-box {
  display: flex;

  .title {
    margin: 0px auto 30px auto;
    text-align: center;
    color: var(--login-title-color);
  }

  :deep(.lang-select--style) {
    line-height: 0;
    color: var(--login-lang-color);
  }
}

.login-form {
  border-radius: 6px;
  background: var(--login-card-bg);
  border: 1px solid var(--login-card-border);
  box-shadow: var(--login-card-shadow);
  backdrop-filter: var(--login-card-backdrop);
  width: 400px;
  padding: 25px 25px 5px 25px;
  z-index: 1;
  .el-input {
    height: 40px;
    input {
      height: 40px;
    }
  }

  .input-icon {
    height: 39px;
    width: 14px;
    margin-left: 0px;
  }

  :deep(.el-input__wrapper) {
    background-color: var(--login-input-bg);
    box-shadow: 0 0 0 1px var(--login-input-border) inset;
  }

  :deep(.el-input__wrapper:hover) {
    box-shadow: 0 0 0 1px var(--login-input-hover-border) inset;
  }

  :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  }
}

.login-tip {
  font-size: 13px;
  text-align: center;
  color: #bfbfbf;
}

.login-code {
  width: 33%;
  height: 40px;
  float: right;

  img {
    cursor: pointer;
    vertical-align: middle;
  }
}

.auth-links {
  float: right;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.auth-links__divider {
  color: var(--el-text-color-placeholder);
}

.oauth-divider {
  margin: 6px 0 14px;
}

.oauth-buttons {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.oauth-button {
  width: 100%;
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

.login-code-img {
  height: 40px;
  padding-left: 12px;
}
</style>

<style lang="scss">
html.dark .login {
  --login-card-bg: rgb(15 20 27 / 90%);
  --login-card-border: rgb(255 255 255 / 14%);
  --login-card-shadow: 0 20px 50px rgb(0 0 0 / 55%);
  --login-card-backdrop: blur(10px);
  --login-title-color: var(--el-text-color-primary);
  --login-lang-color: var(--el-text-color-secondary);
  --login-input-bg: rgb(255 255 255 / 6%);
  --login-input-border: rgb(255 255 255 / 18%);
  --login-input-hover-border: rgb(255 255 255 / 28%);
}
</style>
