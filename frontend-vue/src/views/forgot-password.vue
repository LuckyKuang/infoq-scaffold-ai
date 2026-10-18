<template>
  <div class="register">
    <el-form ref="formRef" :model="form" :rules="rules" class="register-form">
      <div class="title-box">
        <h3 class="title">{{ title }}</h3>
        <lang-select />
      </div>
      <el-form-item prop="email">
        <el-input v-model="form.email" type="text" size="large" auto-complete="off" :placeholder="proxy.$t('forgotPassword.email')">
          <template #prefix><svg-icon icon-class="email" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="emailCode">
        <div class="form-inline-group">
          <el-input v-model="form.emailCode" size="large" auto-complete="off" :placeholder="proxy.$t('forgotPassword.emailCode')">
            <template #prefix><svg-icon icon-class="validCode" class="el-input__icon input-icon" /></template>
          </el-input>
          <el-button :loading="sendingCode" :disabled="countdown > 0" size="large" class="secondary-btn" @click.prevent="handleSendCode">
            {{ countdownText }}
          </el-button>
        </div>
      </el-form-item>
      <el-form-item v-if="captchaEnabled" prop="code">
        <el-input v-model="form.code" size="large" auto-complete="off" :placeholder="proxy.$t('login.code')" style="width: 63%">
          <template #prefix><svg-icon icon-class="validCode" class="el-input__icon input-icon" /></template>
        </el-input>
        <div class="register-code">
          <img :src="codeUrl" class="register-code-img" @click="getCode" />
        </div>
      </el-form-item>
      <el-form-item prop="newPassword">
        <el-input v-model="form.newPassword" type="password" size="large" auto-complete="off" :placeholder="proxy.$t('forgotPassword.newPassword')">
          <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="confirmPassword">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          size="large"
          auto-complete="off"
          :placeholder="proxy.$t('forgotPassword.confirmPassword')"
        >
          <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item style="width: 100%">
        <el-button :loading="loading" size="large" type="primary" style="width: 100%" @click.prevent="handleSubmit">
          <span v-if="!loading">{{ proxy.$t('forgotPassword.submit') }}</span>
          <span v-else>{{ proxy.$t('forgotPassword.submitting') }}</span>
        </el-button>
        <div style="float: right; margin-top: 12px">
          <router-link class="link-type" :to="'/login'">{{ proxy.$t('forgotPassword.switchLoginPage') }}</router-link>
        </div>
      </el-form-item>
    </el-form>
    <div class="el-register-footer">
      <span>Copyright © 2018-2026 Pontus All Rights Reserved.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { forgotPassword, getCodeImg, sendEmailCode } from '@/api/login';
import type { ForgotPasswordForm } from '@/api/types';
import { validEmail } from '@/utils/validate';
import { to } from 'await-to-js';
import { useI18n } from 'vue-i18n';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const title = import.meta.env.VITE_APP_TITLE;
const router = useRouter();
const { t } = useI18n();
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const form = ref<ForgotPasswordForm>({
  email: '',
  emailCode: '',
  newPassword: '',
  confirmPassword: '',
  code: '',
  uuid: ''
});

type ValidatorCallback = (error?: Error) => void;

const equalToPassword = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  if (form.value.newPassword !== value) {
    callback(new Error(t('forgotPassword.rule.confirmPassword.equalToPassword')));
  } else {
    callback();
  }
};

const rules: ElFormRules = {
  email: [
    { required: true, trigger: 'blur', message: t('forgotPassword.rule.email.required') },
    { type: 'email', trigger: 'blur', message: t('forgotPassword.rule.email.invalid') }
  ],
  emailCode: [{ required: true, trigger: 'blur', message: t('forgotPassword.rule.emailCode.required') }],
  newPassword: [
    { required: true, trigger: 'blur', message: t('forgotPassword.rule.newPassword.required') },
    { min: 8, max: 30, message: t('forgotPassword.rule.newPassword.length', { min: 8, max: 30 }), trigger: 'blur' },
    { pattern: PASSWORD_REGEX, message: t('forgotPassword.rule.newPassword.pattern'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, trigger: 'blur', message: t('forgotPassword.rule.confirmPassword.required') },
    { required: true, validator: equalToPassword, trigger: 'blur' }
  ],
  code: [{ required: true, trigger: 'change', message: t('forgotPassword.rule.code.required') }]
};

const formRef = ref<ElFormInstance>();
const loading = ref(false);
const sendingCode = ref(false);
const captchaEnabled = ref(true);
const codeUrl = ref('');
const countdown = ref(0);
let countdownTimer: number | undefined;

const countdownText = computed(() => {
  if (countdown.value > 0) {
    return t('forgotPassword.countdown', { seconds: countdown.value });
  }
  return sendingCode.value ? t('forgotPassword.sendingCode') : t('forgotPassword.sendCode');
});

const startCountdown = () => {
  countdown.value = 60;
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
  }
  countdownTimer = window.setInterval(() => {
    if (countdown.value <= 1) {
      countdown.value = 0;
      if (countdownTimer) {
        window.clearInterval(countdownTimer);
        countdownTimer = undefined;
      }
      return;
    }
    countdown.value -= 1;
  }, 1000);
};

const getCode = async () => {
  const res = await getCodeImg();
  const { data } = res;
  if (!data.forgotPasswordEnabled || !data.mailEnabled) {
    await router.replace('/login');
    return;
  }
  captchaEnabled.value = data.captchaEnabled === undefined ? true : data.captchaEnabled;
  if (captchaEnabled.value) {
    form.value.code = '';
    codeUrl.value = 'data:image/gif;base64,' + data.img;
    form.value.uuid = data.uuid;
  } else {
    form.value.code = '';
    form.value.uuid = '';
    codeUrl.value = '';
  }
};

const handleSendCode = async () => {
  if (!form.value.email) {
    ElMessage.error(t('forgotPassword.rule.email.required'));
    return;
  }
  if (!validEmail(form.value.email)) {
    ElMessage.error(t('forgotPassword.rule.email.invalid'));
    return;
  }
  if (captchaEnabled.value && !form.value.code) {
    ElMessage.error(t('forgotPassword.rule.code.required'));
    return;
  }
  sendingCode.value = true;
  const [err] = await to(
    sendEmailCode({
      email: form.value.email,
      scene: 'forgot_password',
      code: form.value.code,
      uuid: form.value.uuid
    })
  );
  sendingCode.value = false;
  if (!err) {
    ElMessage.success(t('forgotPassword.codeSent'));
    form.value.code = '';
    startCountdown();
  }
  if (captchaEnabled.value) {
    await getCode();
  }
};

const handleSubmit = () => {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    loading.value = true;
    const [err] = await to(forgotPassword(form.value));
    loading.value = false;
    if (!err) {
      ElMessage.success(t('forgotPassword.success'));
      await router.push('/login');
      return;
    }
    if (captchaEnabled.value) {
      await getCode();
    }
  });
};

onMounted(() => {
  getCode();
});

onBeforeUnmount(() => {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
  }
});
</script>

<style lang="scss" scoped>
.register {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background-image: url('../assets/images/login-background.jpg');
  background-size: cover;
}

.title-box {
  display: flex;

  .title {
    margin: 0px auto 30px auto;
    text-align: center;
    color: #707070;
  }

  :deep(.lang-select--style) {
    line-height: 0;
    color: #7483a3;
  }
}

.register-form {
  border-radius: 6px;
  background: #ffffff;
  width: 400px;
  padding: 25px 25px 5px 25px;

  .el-input {
    height: 40px;

    input {
      height: 40px;
    }
  }

  .input-icon {
    height: 39px;
    width: 14px;
    margin-left: 0;
  }
}

.form-inline-group {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 132px;
  gap: 12px;
}

.secondary-btn {
  width: 132px;
}

.register-code {
  width: 33%;
  height: 40px;
  float: right;

  img {
    cursor: pointer;
    vertical-align: middle;
  }
}

.el-register-footer {
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

.register-code-img {
  height: 40px;
  padding-left: 12px;
}
</style>
