<template>
  <view class="login-container">
    <view class="login-header">
      <view class="logo-box">
        <text class="logo-icon">Q</text>
      </view>
      <view class="welcome-text">欢迎回来 👋</view>
      <view class="sub-text">AI-first Full-stack Scaffold</view>
    </view>

    <view class="login-form-card">
      <view class="form-group">
        <view class="input-wrapper">
          <input
            class="custom-input"
            v-model="form.username"
            placeholder="请输入账号"
            placeholder-style="color: #94a3b8; font-weight: 400"
            confirm-type="next"
          />
          <view class="clear-icon" v-if="form.username" @click="form.username = ''">
            <AppIcon name="close-circle" size="36" color="#94a3b8" />
          </view>
        </view>
      </view>

      <view class="form-group">
        <view class="input-wrapper">
          <input
            class="custom-input password-input"
            password
            v-model="form.password"
            placeholder="请输入密码"
            placeholder-style="color: #94a3b8; font-weight: 400"
            confirm-type="done"
            @confirm="handleSubmit"
          />
          <view class="clear-icon" v-if="form.password" @click="form.password = ''">
            <AppIcon name="close-circle" size="36" color="#94a3b8" />
          </view>
        </view>
      </view>

      <view class="form-group" v-if="captchaEnabled">
        <view class="input-wrapper">
          <view class="captcha-row">
            <input
              class="custom-input captcha-input"
              v-model="form.code"
              placeholder="验证码"
              placeholder-style="color: #94a3b8; font-weight: 400"
            />
            <image
              v-if="codeUrl"
              :src="codeUrl"
              mode="aspectFit"
              class="captcha-img"
              @click="loadCaptcha"
            />
          </view>
        </view>
      </view>

      <view class="option-row">
        <view class="remember-check">
          <switch :checked="form.rememberMe" color="#1677ff" @change="form.rememberMe = $event.detail.value" />
          <text>记住登录状态</text>
        </view>
      </view>

      <button
        class="login-btn"
        @click="handleSubmit"
        :disabled="submitting"
      >
        {{ submitting ? '正在验证...' : '登 录' }}
      </button>
      <button v-if="isWeappRuntime && wechatLoginEnabled" class="login-btn wechat-login-btn" :disabled="submitting" @click="handleWechatLogin">
        微信小程序登录
      </button>
    </view>

    <view class="login-footer">
      <text class="copyright">{{ mobileEnv.copyright }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import {reactive, ref} from 'vue';
import {onLoad} from '@dcloudio/uni-app';
import {
  asCaptchaImage,
  getCodeImg,
  getRememberedLogin,
  getWechatMiniAppEnabled,
  mobileEnv,
  setRememberedLogin
} from '@/api';
import AppIcon from '@/components/AppIcon.vue';
import {routes} from '@/utils/navigation';
import {handlePageError} from '@/utils/ui';
import {useSessionStore} from '@/store/session';

const sessionStore = useSessionStore();
const submitting = ref(false);
const captchaEnabled = ref(true);
const codeUrl = ref('');
const wechatLoginEnabled = ref(false);
const isWeappRuntime = mobileEnv.taroEnv === 'weapp';

const form = reactive({
  username: '',
  password: '',
  rememberMe: false,
  code: '',
  uuid: ''
});

const loadCaptcha = async () => {
  try {
    const response = await getCodeImg();
    const data = response.data;
    const enabled = data.captchaEnabled === undefined ? true : data.captchaEnabled;
    captchaEnabled.value = enabled;
    if (enabled) {
      codeUrl.value = await asCaptchaImage(data.img, data.uuid);
      form.code = '';
      form.uuid = data.uuid || '';
    } else {
      codeUrl.value = '';
    }
  } catch (error) {
    codeUrl.value = '';
    await handlePageError(error, '验证码获取失败。');
  }
};

const handleSubmit = async () => {
  if (!form.username.trim() || !form.password.trim()) {
    await uni.showToast({ title: '请输入账号和密码', icon: 'none' });
    return;
  }
  if (captchaEnabled.value && !form.code.trim()) {
    await uni.showToast({ title: '请输入验证码', icon: 'none' });
    return;
  }

  submitting.value = true;
  try {
    await sessionStore.signIn(form);
    if (form.rememberMe) {
      setRememberedLogin({
        username: form.username.trim(),
        password: form.password,
        rememberMe: form.rememberMe
      });
    } else {
      setRememberedLogin({ username: '', password: '', rememberMe: false });
    }
    await uni.showToast({ title: '欢迎回来', icon: 'success' });
    uni.reLaunch({ url: routes.home });
  } catch (error) {
    await handlePageError(error, '登录失败，请检查账号信息');
    if (captchaEnabled.value) {
      await loadCaptcha();
    }
  } finally {
    submitting.value = false;
  }
};

const handleWechatLogin = async () => {
  submitting.value = true;
  try {
    const result = await uni.login();
    if (!result.code) {
      throw new Error('未获取到微信授权 code');
    }
    await sessionStore.signIn({ clientId: mobileEnv.clientId, grantType: 'xcx', code: result.code });
    await uni.showToast({ title: '欢迎回来', icon: 'success' });
    uni.reLaunch({ url: routes.home });
  } catch (error) {
    await handlePageError(error, '微信登录失败');
  } finally {
    submitting.value = false;
  }
};

onLoad(() => {
  const rememberedLogin = getRememberedLogin();
  form.username = rememberedLogin.username;
  form.password = rememberedLogin.password;
  form.rememberMe = rememberedLogin.rememberMe;
  void loadCaptcha();
  if (isWeappRuntime) {
    void getWechatMiniAppEnabled().then((response) => { wechatLoginEnabled.value = response.data; }).catch(() => { wechatLoginEnabled.value = false; });
  }
});
</script>

<style lang="scss">
@import './index.scss';
</style>
