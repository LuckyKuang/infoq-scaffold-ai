export default {
  // 路由国际化
  route: {
    dashboard: 'Dashboard'
  },
  // 登录页面国际化
  login: {
    selectPlaceholder: 'Please select/enter a company name',
    username: 'Username',
    password: 'Password',
    login: 'Login',
    logging: 'Logging...',
    code: 'Verification Code',
    rememberPassword: 'Remember me',
    switchRegisterPage: 'Sign up now',
    switchForgotPasswordPage: 'Forgot password',
    oauthDivider: 'Third-party login',
    oauthProvider: 'Continue with {provider}',
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
  // 注册页面国际化
  register: {
    selectPlaceholder: 'Please select/enter a company name',
    inviteCode: 'Invite Code',
    email: 'Email',
    emailCode: 'Email Code',
    username: 'Username',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    sendCode: 'Send Code',
    sendingCode: 'Sending...',
    codeSent: 'Verification code sent. Please check your email',
    countdown: 'Retry in {seconds}s',
    register: 'Register',
    registering: 'Registering...',
    registerSuccess: 'Congratulations, your {username} account has been registered!',
    code: 'Verification Code',
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
        length: 'The length of the user account must be between {min} and {max}'
      },
      password: {
        required: 'Please enter your password',
        length: 'The user password must be between {min} and {max} in length',
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
    countdown: 'Retry in {seconds}s',
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
        length: 'The user password must be between {min} and {max} in length',
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
  // 导航栏国际化
  navbar: {
    full: 'Full Screen',
    language: 'Language',
    dashboard: 'Dashboard',
    message: 'Message',
    layoutSize: 'Layout Size',
    layoutSetting: 'Layout Setting',
    personalCenter: 'Personal Center',
    logout: 'Logout'
  }
};
