export default {
  // 路由国际化
  route: {
    dashboard: '首页'
  },
  // 登录页面国际化
  login: {
    selectPlaceholder: '请选择/输入公司名称',
    username: '用户名',
    password: '密码',
    login: '登 录',
    logging: '登 录 中...',
    code: '验证码',
    rememberPassword: '记住我',
    switchRegisterPage: '立即注册',
    switchForgotPasswordPage: '忘记密码',
    oauthDivider: '第三方登录',
    oauthProvider: '使用 {provider} 登录',
    rule: {
      username: {
        required: '请输入您的账号'
      },
      password: {
        required: '请输入您的密码'
      },
      code: {
        required: '请输入验证码'
      }
    }
  },
  oauthCallback: {
    processing: '正在完成第三方登录...',
    failedTitle: '第三方登录失败',
    failed: '第三方登录失败，请重新登录',
    missingTicket: '登录凭据缺失，请重新登录',
    backToLogin: '返回登录'
  },
  // 注册页面国际化
  register: {
    selectPlaceholder: '请选择/输入公司名称',
    inviteCode: '邀请码',
    email: '邮箱',
    emailCode: '邮箱验证码',
    username: '用户名',
    password: '密码',
    confirmPassword: '确认密码',
    sendCode: '发送验证码',
    sendingCode: '发送中...',
    codeSent: '验证码已发送，请检查邮箱',
    countdown: '{seconds}s 后重试',
    register: '注 册',
    registering: '注 册 中...',
    registerSuccess: '恭喜你，您的账号 {username} 注册成功！',
    code: '验证码',
    switchLoginPage: '使用已有账户登录',
    rule: {
      email: {
        required: '请输入邮箱',
        invalid: '请输入正确的邮箱地址'
      },
      emailCode: {
        required: '请输入邮箱验证码'
      },
      inviteCode: {
        required: '请输入邀请码',
        invalid: '邀请码不可用'
      },
      username: {
        required: '请输入您的账号',
        length: '用户账号长度必须介于 {min} 和 {max} 之间'
      },
      password: {
        required: '请输入您的密码',
        length: '用户密码长度必须介于 {min} 和 {max} 之间',
        pattern: '密码必须包含大写字母、小写字母、数字和特殊字符'
      },
      code: {
        required: '请输入验证码'
      },
      confirmPassword: {
        required: '请再次输入您的密码',
        equalToPassword: '两次输入的密码不一致'
      }
    }
  },
  forgotPassword: {
    email: '邮箱',
    emailCode: '邮箱验证码',
    newPassword: '新密码',
    confirmPassword: '确认新密码',
    sendCode: '发送验证码',
    sendingCode: '发送中...',
    codeSent: '验证码已发送，请检查邮箱',
    countdown: '{seconds}s 后重试',
    submit: '重置密码',
    submitting: '重置中...',
    success: '密码重置成功，请使用新密码登录',
    switchLoginPage: '返回登录',
    rule: {
      email: {
        required: '请输入邮箱',
        invalid: '请输入正确的邮箱地址'
      },
      emailCode: {
        required: '请输入邮箱验证码'
      },
      newPassword: {
        required: '请输入新密码',
        length: '用户密码长度必须介于 {min} 和 {max} 之间',
        pattern: '密码必须包含大写字母、小写字母、数字和特殊字符'
      },
      confirmPassword: {
        required: '请再次输入新密码',
        equalToPassword: '两次输入的密码不一致'
      },
      code: {
        required: '请输入验证码'
      }
    }
  },
  // 导航栏国际化
  navbar: {
    full: '全屏',
    language: '语言',
    dashboard: '首页',
    message: '消息',
    layoutSize: '布局大小',
    layoutSetting: '布局设置',
    personalCenter: '个人中心',
    logout: '退出登录'
  }
};
