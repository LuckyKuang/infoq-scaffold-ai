import {GithubOutlined, LockOutlined, LoginOutlined, SafetyCertificateOutlined, UserOutlined,} from '@ant-design/icons';
import {LoginForm, ProFormCheckbox, ProFormText,} from '@ant-design/pro-components';
import {Helmet, history, Link, useModel} from '@umijs/max';
import {App, Button, Divider} from 'antd';
import {createStyles} from 'antd-style';
import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import LangSelect from '@/components/LangSelect';
import {getCodeImg, getOAuthProviders, login,} from '@/services/ant-design-pro/api';
import {useUserStore} from '@/store/modules/user';
import {setToken} from '@/utils/auth';
import '@/lang';
import Settings from '../../../../config/defaultSettings';

const useStyles = createStyles(({ token }) => ({
  lang: {
    width: 42,
    height: 42,
    lineHeight: '42px',
    position: 'fixed',
    right: 16,
    borderRadius: token.borderRadius,
    ':hover': {
      backgroundColor: token.colorBgTextHover,
    },
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    overflow: 'auto',
    background: token.colorBgLayout,
  },
  main: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
  },
  captcha: {
    height: 32,
    cursor: 'pointer',
    borderRadius: token.borderRadiusSM,
    border: `1px solid ${token.colorBorderSecondary}`,
  },
  oauthList: {
    display: 'grid',
    gap: 10,
  },
}));

const Lang = () => {
  const { styles } = useStyles();
  return (
    <div className={styles.lang} data-lang>
      <LangSelect />
    </div>
  );
};

const getSafeRedirectUrl = (redirect: string | null): string => {
  if (!redirect?.startsWith('/')) {
    return '/index';
  }
  if (redirect.startsWith('//')) {
    return '/index';
  }
  try {
    const parsed = new URL(redirect, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return '/index';
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/index';
  }
};

const getRememberedLoginValues = (): Partial<API.LoginParams> => ({
  username: localStorage.getItem('username') || '',
  password: localStorage.getItem('password') || '',
  rememberMe: localStorage.getItem('rememberMe') === 'true',
});

const syncRememberedLoginValues = (values: API.LoginParams) => {
  if (values.rememberMe) {
    localStorage.setItem('username', values.username || '');
    localStorage.setItem('password', values.password || '');
    localStorage.setItem('rememberMe', 'true');
    return;
  }
  localStorage.removeItem('username');
  localStorage.removeItem('password');
  localStorage.removeItem('rememberMe');
};

const renderProviderIcon = (providerCode: string) =>
  providerCode === 'github' ? <GithubOutlined /> : <LoginOutlined />;

const Login: React.FC = () => {
  const [captchaEnabled, setCaptchaEnabled] = useState(true);
  const [codeUrl, setCodeUrl] = useState('');
  const [captchaUuid, setCaptchaUuid] = useState<string | undefined>();
  const [registerEnabled, setRegisterEnabled] = useState(false);
  const [forgotPasswordEnabled, setForgotPasswordEnabled] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<
    API.OAuthProviderOption[]
  >([]);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState('');
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [rememberedLoginValues] = useState(() => getRememberedLoginValues());
  const formatMessage = (id: string, defaultMessage: string) =>
    t(id, { defaultValue: defaultMessage });

  const loadCode = useCallback(async () => {
    try {
      const res = await getCodeImg();
      const data = res.data;
      const enabled =
        data?.captchaEnabled === undefined ? true : data.captchaEnabled;
      setCaptchaEnabled(enabled);
      setRegisterEnabled(Boolean(data?.registerEnabled && data.mailEnabled));
      setForgotPasswordEnabled(
        Boolean(data?.forgotPasswordEnabled && data.mailEnabled),
      );
      setCaptchaUuid(enabled ? data?.uuid : undefined);
      setCodeUrl(
        enabled && data?.img ? `data:image/gif;base64,${data.img}` : '',
      );
    } catch {
      setCaptchaEnabled(true);
      setRegisterEnabled(false);
      setForgotPasswordEnabled(false);
      setCaptchaUuid(undefined);
      setCodeUrl('');
    }
  }, []);

  useEffect(() => {
    loadCode();
    let mounted = true;
    getOAuthProviders()
      .then((res) => {
        if (mounted) {
          setOauthProviders(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch(() => {
        if (mounted) {
          setOauthProviders([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, [loadCode]);

  const handleSubmit = async (values: API.LoginParams) => {
    try {
      const msg = await login(
        {
          ...values,
          uuid: captchaEnabled ? captchaUuid : undefined,
        },
        {
          skipErrorHandler: true,
        },
      );
      setToken(msg.data.access_token);
      useUserStore.getState().initializeRealtimeChannels();
      syncRememberedLoginValues(values);
      const authState = await initialState?.fetchUserInfo?.();
      setInitialState((s) => ({
        ...s,
        ...authState,
      }));
      message.success(
        formatMessage('pages.login.success', '登录成功！'),
      );
      const urlParams = new URL(window.location.href).searchParams;
      history.replace(getSafeRedirectUrl(urlParams.get('redirect')));
    } catch {
      if (captchaEnabled) {
        await loadCode();
      }
      message.error(
        formatMessage('pages.login.failure', '登录失败，请重试！'),
      );
    }
  };

  const handleOAuthAuthorize = (provider: API.OAuthProviderOption) => {
    const redirect =
      new URL(window.location.href).searchParams.get('redirect') || '/index';
    const params = new URLSearchParams({
      clientId: process.env.VITE_APP_CLIENT_ID || '',
      redirect,
    });
    setOauthLoadingProvider(provider.providerCode);
    window.location.assign(
      `${process.env.VITE_APP_BASE_API}/auth/oauth/${provider.providerCode}/authorize?${params.toString()}`,
    );
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>
          {formatMessage('menu.login', '登录页')}
          {Settings.title && ` - ${Settings.title}`}
        </title>
      </Helmet>
      <Lang />
      <div className={`${styles.main} login-form-shell`}>
        <LoginForm
          contentStyle={{ minWidth: 280, maxWidth: '75vw' }}
          logo={<img alt="logo" src={Settings.logo} />}
          title={process.env.VITE_APP_LOGO_TITLE || 'infoq-scaffold-backend'}
          subTitle={process.env.VITE_APP_TITLE || '后台管理系统'}
          initialValues={rememberedLoginValues}
          onFinish={async (values) => {
            await handleSubmit(values as API.LoginParams);
          }}
        >
          <ProFormText
            name="username"
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />,
              autoComplete: 'username',
            }}
            placeholder={formatMessage(
              'pages.login.username.placeholder',
              '用户名',
            )}
            rules={[
              {
                required: true,
                message: formatMessage(
                  'pages.login.username.required',
                  '请输入用户名!',
                ),
              },
            ]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />,
              autoComplete: 'current-password',
            }}
            placeholder={formatMessage(
              'pages.login.password.placeholder',
              '密码',
            )}
            rules={[
              {
                required: true,
                message: formatMessage(
                  'pages.login.password.required',
                  '请输入密码！',
                ),
              },
            ]}
          />
          {captchaEnabled && (
            <ProFormText
              name="code"
              fieldProps={{
                size: 'large',
                prefix: <SafetyCertificateOutlined />,
                autoComplete: 'off',
                suffix: codeUrl ? (
                  <img
                    className={styles.captcha}
                    src={codeUrl}
                    alt="captcha"
                    onClick={loadCode}
                  />
                ) : null,
              }}
              placeholder={formatMessage(
                'pages.login.captcha.placeholder',
                '请输入验证码',
              )}
              rules={[
                {
                  required: true,
                  message: formatMessage(
                    'pages.login.captcha.required',
                    '请输入验证码！',
                  ),
                },
              ]}
            />
          )}
          <div style={{ marginBottom: 24 }}>
            <ProFormCheckbox noStyle name="rememberMe">
              {formatMessage('pages.login.rememberMe', '记住我')}
            </ProFormCheckbox>
            <span style={{ float: 'right' }}>
              {forgotPasswordEnabled && (
                <Link to="/forgot-password">
                  {formatMessage('pages.login.forgotPassword', '忘记密码')}
                </Link>
              )}
              {forgotPasswordEnabled && registerEnabled && <span> | </span>}
              {registerEnabled && (
                <Link to="/register">
                  {formatMessage('pages.login.registerAccount', '注册账号')}
                </Link>
              )}
            </span>
          </div>
          {oauthProviders.length > 0 && (
            <>
              <Divider plain style={{ margin: '6px 0 14px' }}>
                其他登录方式
              </Divider>
              <div className={styles.oauthList}>
                {oauthProviders.map((provider) => (
                  <Button
                    key={provider.providerCode}
                    block
                    icon={renderProviderIcon(provider.providerCode)}
                    loading={oauthLoadingProvider === provider.providerCode}
                    onClick={() => handleOAuthAuthorize(provider)}
                  >
                    {provider.providerName}
                  </Button>
                ))}
              </div>
            </>
          )}
        </LoginForm>
      </div>
    </div>
  );
};

export default Login;
