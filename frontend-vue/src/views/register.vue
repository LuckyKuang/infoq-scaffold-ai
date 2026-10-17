<template>
  <div class="register">
    <el-form ref="registerRef" :model="registerForm" :rules="registerRules" class="register-form">
      <div class="title-box">
        <h3 class="title">{{ title }}</h3>
        <lang-select />
      </div>
      <el-form-item v-if="inviteRegisterEnabled" prop="inviteCode">
        <el-input
          v-model="registerForm.inviteCode"
          type="text"
          size="large"
          auto-complete="off"
          :placeholder="proxy.$t('register.inviteCode')"
          @blur="handleInviteBlur"
          @input="handleInviteInput"
        >
          <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="email">
        <el-input v-model="registerForm.email" type="text" size="large" auto-complete="off" :placeholder="proxy.$t('register.email')">
          <template #prefix><svg-icon icon-class="email" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="emailCode">
        <div class="form-inline-group">
          <el-input
            v-model="registerForm.emailCode"
            size="large"
            auto-complete="off"
            :placeholder="proxy.$t('register.emailCode')"
            @keyup.enter="handleRegister"
          >
            <template #prefix><svg-icon icon-class="validCode" class="el-input__icon input-icon" /></template>
          </el-input>
          <el-button :loading="sendingCode" :disabled="sendCodeDisabled" size="large" class="secondary-btn" @click.prevent="handleSendCode">
            {{ countdownText }}
          </el-button>
        </div>
      </el-form-item>
      <el-form-item v-if="captchaEnabled" prop="code">
        <el-input
          v-model="registerForm.code"
          size="large"
          auto-complete="off"
          :placeholder="proxy.$t('register.code')"
          style="width: 63%"
          @keyup.enter="handleRegister"
        >
          <template #prefix><svg-icon icon-class="validCode" class="el-input__icon input-icon" /></template>
        </el-input>
        <div class="register-code">
          <img :src="codeUrl" class="register-code-img" @click="getCode" />
        </div>
      </el-form-item>
      <el-form-item prop="username">
        <el-input v-model="registerForm.username" type="text" size="large" auto-complete="off" :placeholder="proxy.$t('register.username')">
          <template #prefix><svg-icon icon-class="user" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="password">
        <el-input
          v-model="registerForm.password"
          type="password"
          size="large"
          auto-complete="off"
          :placeholder="proxy.$t('register.password')"
          @keyup.enter="handleRegister"
        >
          <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="confirmPassword">
        <el-input
          v-model="registerForm.confirmPassword"
          type="password"
          size="large"
          auto-complete="off"
          :placeholder="proxy.$t('register.confirmPassword')"
          @keyup.enter="handleRegister"
        >
          <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
        </el-input>
      </el-form-item>
      <el-form-item style="width: 100%">
        <el-button :loading="loading" size="large" type="primary" style="width: 100%" @click.prevent="handleRegister">
          <span v-if="!loading">{{ proxy.$t('register.register') }}</span>
          <span v-else>{{ proxy.$t('register.registering') }}</span>
        </el-button>
        <div style="float: right">
          <router-link class="link-type" :to="'/login'">{{ proxy.$t('register.switchLoginPage') }}</router-link>
        </div>
      </el-form-item>
    </el-form>
    <!--  底部  -->
    <div class="el-register-footer">
      <span>Copyright © 2018-2026 Pontus All Rights Reserved.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { checkInviteCode, getCodeImg, register, sendEmailCode } from '@/api/login';
import { RegisterForm } from '@/api/types';
import { to } from 'await-to-js';
import { useI18n } from 'vue-i18n';
import { validEmail } from '@/utils/validate';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const title = import.meta.env.VITE_APP_TITLE;
const router = useRouter();

const { t } = useI18n();

const registerForm = ref<RegisterForm>({
  inviteCode: '',
  email: '',
  emailCode: '',
  username: '',
  password: '',
  confirmPassword: '',
  code: '',
  uuid: ''
});

type ValidatorCallback = (error?: Error) => void;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const equalToPassword = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  if (registerForm.value.password !== value) {
    callback(new Error(t('register.rule.confirmPassword.equalToPassword')));
  } else {
    callback();
  }
};

const validateInviteCode = (_rule: unknown, value: string | undefined, callback: ValidatorCallback) => {
  if (!inviteRegisterEnabled.value) {
    callback();
    return;
  }
  if (!value) {
    callback(new Error(t('register.rule.inviteCode.required')));
    return;
  }
  if (!inviteCodeValid.value) {
    callback(new Error(t('register.rule.inviteCode.invalid')));
    return;
  }
  callback();
};

const registerRules: ElFormRules = {
  inviteCode: [{ required: true, validator: validateInviteCode, trigger: 'blur' }],
  email: [
    { required: true, trigger: 'blur', message: t('register.rule.email.required') },
    { type: 'email', trigger: 'blur', message: t('register.rule.email.invalid') }
  ],
  emailCode: [{ required: true, trigger: 'blur', message: t('register.rule.emailCode.required') }],
  username: [
    { required: true, trigger: 'blur', message: t('register.rule.username.required') },
    { min: 2, max: 20, message: t('register.rule.username.length', { min: 2, max: 20 }), trigger: 'blur' }
  ],
  password: [
    { required: true, trigger: 'blur', message: t('register.rule.password.required') },
    { min: 8, max: 30, message: t('register.rule.password.length', { min: 8, max: 30 }), trigger: 'blur' },
    { pattern: PASSWORD_REGEX, message: t('register.rule.password.pattern'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, trigger: 'blur', message: t('register.rule.confirmPassword.required') },
    { required: true, validator: equalToPassword, trigger: 'blur' }
  ],
  code: [{ required: true, trigger: 'change', message: t('register.rule.code.required') }]
};
const codeUrl = ref('');
const loading = ref(false);
const sendingCode = ref(false);
const countdown = ref(0);
const captchaEnabled = ref(true);
const inviteRegisterEnabled = ref(false);
const inviteCodeValid = ref(false);
const inviteChecking = ref(false);
const lastValidatedInviteCode = ref('');
const registerRef = ref<ElFormInstance>();
let countdownTimer: number | undefined;

const countdownText = computed(() => {
  if (countdown.value > 0) {
    return t('register.countdown', { seconds: countdown.value });
  }
  return sendingCode.value ? t('register.sendingCode') : t('register.sendCode');
});

const sendCodeDisabled = computed(() => {
  if (countdown.value > 0) {
    return true;
  }
  if (!inviteRegisterEnabled.value) {
    return false;
  }
  return inviteChecking.value || !inviteCodeValid.value;
});

const resetInviteValidation = () => {
  inviteCodeValid.value = false;
  lastValidatedInviteCode.value = '';
};

const handleInviteInput = () => {
  if (!inviteRegisterEnabled.value) {
    return;
  }
  resetInviteValidation();
};

const handleInviteBlur = async () => {
  if (!inviteRegisterEnabled.value) {
    return;
  }
  const inviteCode = registerForm.value.inviteCode?.trim();
  registerForm.value.inviteCode = inviteCode;
  if (!inviteCode) {
    resetInviteValidation();
    return;
  }
  if (inviteCodeValid.value && lastValidatedInviteCode.value === inviteCode) {
    return;
  }
  inviteChecking.value = true;
  const [err] = await to(checkInviteCode(inviteCode));
  inviteChecking.value = false;
  if (err) {
    resetInviteValidation();
    registerRef.value?.validateField?.('inviteCode');
    return;
  }
  inviteCodeValid.value = true;
  lastValidatedInviteCode.value = inviteCode;
};

const handleRegister = () => {
  registerRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      if (inviteRegisterEnabled.value && !inviteCodeValid.value) {
        return;
      }
      loading.value = true;
      const [err] = await to(register(registerForm.value));
      if (!err) {
        const username = registerForm.value.username;
        await ElMessageBox.alert('<span style="color: red; ">' + t('register.registerSuccess', { username }) + '</font>', '系统提示', {
          app: undefined,
          dangerouslyUseHTMLString: true,
          type: 'success'
        });
        await router.push('/login');
      } else {
        loading.value = false;
        if (captchaEnabled.value) {
          await getCode();
        }
      }
    }
  });
};

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

const handleSendCode = async () => {
  if (inviteRegisterEnabled.value && !registerForm.value.inviteCode) {
    ElMessage.error(t('register.rule.inviteCode.required'));
    return;
  }
  if (inviteRegisterEnabled.value && !inviteCodeValid.value) {
    ElMessage.error(t('register.rule.inviteCode.invalid'));
    return;
  }
  if (!registerForm.value.email) {
    ElMessage.error(t('register.rule.email.required'));
    return;
  }
  if (!validEmail(registerForm.value.email)) {
    ElMessage.error(t('register.rule.email.invalid'));
    return;
  }
  if (captchaEnabled.value && !registerForm.value.code) {
    ElMessage.error(t('register.rule.code.required'));
    return;
  }
  sendingCode.value = true;
  const [err] = await to(
    sendEmailCode({
      inviteCode: registerForm.value.inviteCode,
      email: registerForm.value.email,
      scene: 'register',
      code: registerForm.value.code,
      uuid: registerForm.value.uuid
    })
  );
  sendingCode.value = false;
  if (!err) {
    ElMessage.success(t('register.codeSent'));
    registerForm.value.code = '';
    startCountdown();
  }
  if (captchaEnabled.value) {
    await getCode();
  }
};

const getCode = async () => {
  const res = await getCodeImg();
  const { data } = res;
  if (!data.registerEnabled || !data.mailEnabled) {
    await router.replace('/login');
    return;
  }
  inviteRegisterEnabled.value = data.inviteRegisterEnabled === true;
  if (!inviteRegisterEnabled.value) {
    registerForm.value.inviteCode = '';
    resetInviteValidation();
  }
  captchaEnabled.value = data.captchaEnabled === undefined ? true : data.captchaEnabled;
  if (captchaEnabled.value) {
    registerForm.value.code = '';
    codeUrl.value = 'data:image/gif;base64,' + data.img;
    registerForm.value.uuid = data.uuid;
  } else {
    registerForm.value.code = '';
    registerForm.value.uuid = '';
    codeUrl.value = '';
  }
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

.register-tip {
  font-size: 13px;
  text-align: center;
  color: #bfbfbf;
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
