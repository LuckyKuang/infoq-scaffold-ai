import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LanguageEnum } from '@/enums/LanguageEnum';

const resources = {
  zh_CN: {
    translation: {
      login: {
        title: 'infoq-scaffold-backend 后台管理系统',
        username: '用户名',
        password: '密码',
        code: '验证码',
        rememberPassword: '记住我',
        switchRegisterPage: '立即注册',
        switchForgotPasswordPage: '忘记密码',
        oauthDivider: '第三方登录',
        oauthProvider: '使用 {{provider}} 登录',
        login: '登 录',
        logging: '登 录 中...',
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
      register: {
        inviteCode: '邀请码',
        email: '邮箱',
        emailCode: '邮箱验证码',
        username: '用户名',
        password: '密码',
        confirmPassword: '确认密码',
        sendCode: '发送验证码',
        sendingCode: '发送中...',
        codeSent: '验证码已发送，请检查邮箱',
        countdown: '{{seconds}}s 后重试',
        code: '验证码',
        register: '注 册',
        registering: '注 册 中...',
        registerSuccess: '恭喜你，您的账号 {{username}} 注册成功！',
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
            length: '用户账号长度必须介于 {{min}} 和 {{max}} 之间'
          },
          password: {
            required: '请输入您的密码',
            length: '用户密码长度必须介于 {{min}} 和 {{max}} 之间',
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
        countdown: '{{seconds}}s 后重试',
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
            length: '用户密码长度必须介于 {{min}} 和 {{max}} 之间',
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
      common: {
        logout: '退出登录',
        welcome: '欢迎使用'
      },
      navbar: {
        search: '搜索',
        message: '消息',
        full: '全屏',
        language: '语言',
        layoutSize: '布局大小',
        layoutSetting: '布局设置',
        layoutSizeUpdated: '布局大小切换成功！',
        personalCenter: '个人中心',
        github: 'Github'
      },
      notice: {
        title: '通知公告',
        markAllRead: '全部已读',
        empty: '消息为空',
        read: '已读',
        unread: '未读'
      },
      settings: {
        appearanceTitle: '主题风格设置',
        layoutTitle: '系统布局配置',
        themeColor: '主题颜色',
        darkMode: '深色模式',
        themeDark: '深色侧栏',
        themeLight: '浅色侧栏',
        topNav: '开启 TopNav',
        tagsView: '开启 Tags-Views',
        tagsIcon: '显示页签图标',
        fixedHeader: '固定 Header',
        sidebarLogo: '显示 Logo',
        dynamicTitle: '动态标题',
        save: '保存配置',
        reset: '重置配置',
        saved: '配置已保存到本地',
        resetDone: '已恢复默认布局配置'
      }
    }
  },
  en_US: {
    translation: {
      login: {
        title: 'InfoQ Scaffold Admin',
        username: 'Username',
        password: 'Password',
        code: 'Verification Code',
        rememberPassword: 'Remember me',
        switchRegisterPage: 'Sign up now',
        switchForgotPasswordPage: 'Forgot password',
        oauthDivider: 'Third-party login',
        oauthProvider: 'Continue with {{provider}}',
        login: 'Login',
        logging: 'Signing in...',
        rule: {
          username: {
            required: 'Please enter your account'
          },
          password: {
            required: 'Please enter your password'
          },
          code: {
            required: 'Please enter a verification code'
          }
        }
      },
      oauthCallback: {
        processing: 'Completing third-party login...',
        failedTitle: 'Third-party login failed',
        failed: 'Third-party login failed. Please sign in again',
        missingTicket: 'Login credential is missing. Please sign in again',
        backToLogin: 'Back to login'
      },
      register: {
        inviteCode: 'Invite Code',
        email: 'Email',
        emailCode: 'Email Code',
        username: 'Username',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        sendCode: 'Send Code',
        sendingCode: 'Sending...',
        codeSent: 'Verification code sent. Please check your email',
        countdown: 'Retry in {{seconds}}s',
        code: 'Verification Code',
        register: 'Register',
        registering: 'Registering...',
        registerSuccess: 'Congratulations, your {{username}} account has been registered!',
        switchLoginPage: 'Log in with an existing account',
        rule: {
          email: {
            required: 'Please enter your email',
            invalid: 'Please enter a valid email address'
          },
          emailCode: {
            required: 'Please enter the email verification code'
          },
          inviteCode: {
            required: 'Please enter the invite code',
            invalid: 'Invite code is unavailable'
          },
          username: {
            required: 'Please enter your account',
            length: 'The length of the user account must be between {{min}} and {{max}}'
          },
          password: {
            required: 'Please enter your password',
            length: 'The user password must be between {{min}} and {{max}} in length',
            pattern: 'Password must contain uppercase, lowercase, number, and special character'
          },
          code: {
            required: 'Please enter a verification code'
          },
          confirmPassword: {
            required: 'Please enter your password again',
            equalToPassword: 'The password entered twice is inconsistent'
          }
        }
      },
      forgotPassword: {
        email: 'Email',
        emailCode: 'Email Code',
        newPassword: 'New Password',
        confirmPassword: 'Confirm New Password',
        sendCode: 'Send Code',
        sendingCode: 'Sending...',
        codeSent: 'Verification code sent. Please check your email',
        countdown: 'Retry in {{seconds}}s',
        submit: 'Reset Password',
        submitting: 'Resetting...',
        success: 'Password reset successful. Please sign in with your new password',
        switchLoginPage: 'Back to login',
        rule: {
          email: {
            required: 'Please enter your email',
            invalid: 'Please enter a valid email address'
          },
          emailCode: {
            required: 'Please enter the email verification code'
          },
          newPassword: {
            required: 'Please enter your new password',
            length: 'The user password must be between {{min}} and {{max}} in length',
            pattern: 'Password must contain uppercase, lowercase, number, and special character'
          },
          confirmPassword: {
            required: 'Please enter your password again',
            equalToPassword: 'The password entered twice is inconsistent'
          },
          code: {
            required: 'Please enter a verification code'
          }
        }
      },
      common: {
        logout: 'Logout',
        welcome: 'Welcome'
      },
      navbar: {
        search: 'Search',
        message: 'Message',
        full: 'Full Screen',
        language: 'Language',
        layoutSize: 'Layout Size',
        layoutSetting: 'Layout Setting',
        layoutSizeUpdated: 'Layout size updated successfully!',
        personalCenter: 'Personal Center',
        github: 'Github'
      },
      notice: {
        title: 'Notifications',
        markAllRead: 'Mark all as read',
        empty: 'No messages',
        read: 'Read',
        unread: 'Unread'
      },
      settings: {
        appearanceTitle: 'Theme Style Settings',
        layoutTitle: 'System Layout Settings',
        themeColor: 'Theme Color',
        darkMode: 'Dark Mode',
        themeDark: 'Dark Sidebar',
        themeLight: 'Light Sidebar',
        topNav: 'Enable TopNav',
        tagsView: 'Enable Tags-Views',
        tagsIcon: 'Show Tag Icons',
        fixedHeader: 'Fixed Header',
        sidebarLogo: 'Show Logo',
        dynamicTitle: 'Dynamic Title',
        save: 'Save Settings',
        reset: 'Reset Settings',
        saved: 'Settings saved locally',
        resetDone: 'Layout settings reset to defaults'
      }
    }
  }
};

export const getLanguage = (): LanguageEnum => {
  return (localStorage.getItem('language') as LanguageEnum) || LanguageEnum.zh_CN;
};

i18n.use(initReactI18next).init({
  resources,
  lng: getLanguage(),
  fallbackLng: LanguageEnum.zh_CN,
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
