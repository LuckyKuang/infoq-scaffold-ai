import { GithubOutlined, LoginOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Divider, Form, Input } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCodeImg, getOAuthProviders } from '@/api/login';
import type { LoginData, OAuthProviderOption } from '@/api/types';
import AuthPageShell from '@/components/AuthPageShell';
import SvgIcon from '@/components/SvgIcon';
import { useUserStore } from '@/store/modules/user';
import { useTranslation } from 'react-i18next';
import { requireAppRedirect, toDeploymentRedirect } from '@/utils/auth-redirect';

export default function LoginPage() {
  const [form] = Form.useForm<LoginData>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [captchaEnabled, setCaptchaEnabled] = useState(true);
  const [codeUrl, setCodeUrl] = useState('');
  const [registerEnabled, setRegisterEnabled] = useState(false);
  const [forgotPasswordEnabled, setForgotPasswordEnabled] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<OAuthProviderOption[]>([]);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState('');
  const [redirectError, setRedirectError] = useState(false);
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();
  const login = useUserStore((state) => state.login);
  const { t } = useTranslation();
  const title = import.meta.env.VITE_APP_TITLE || t('login.title');
  const authIconStyle = { color: '#bfbfbf' };

  const getCode = useCallback(async () => {
    try {
      const res = await getCodeImg();
      const data = res?.data;
      const enabled = data?.captchaEnabled === undefined ? true : data.captchaEnabled;
      setCaptchaEnabled(enabled);
      setRegisterEnabled(Boolean(data?.registerEnabled && data.mailEnabled));
      setForgotPasswordEnabled(Boolean(data?.forgotPasswordEnabled && data.mailEnabled));
      if (enabled) {
        setCodeUrl(`data:image/gif;base64,${data?.img || ''}`);
        form.setFieldValue('uuid', data?.uuid);
        form.setFieldValue('code', '');
        return;
      }
      setCodeUrl('');
      form.setFieldValue('uuid', undefined);
      form.setFieldValue('code', undefined);
    } catch {
      setRegisterEnabled(false);
      setForgotPasswordEnabled(false);
      setCodeUrl('');
      form.setFieldValue('code', '');
      form.setFieldValue('uuid', undefined);
    }
  }, [form]);

  useEffect(() => {
    document.title = title;
    localStorage.removeItem('password');
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    if (!rememberMe) {
      localStorage.removeItem('username');
      localStorage.removeItem('rememberMe');
    }
    form.setFieldsValue({
      username: rememberMe ? localStorage.getItem('username') || '' : '',
      password: '',
      rememberMe
    });
    getCode();
  }, [form, getCode, title]);

  useEffect(() => {
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
  }, []);

  const onFinish = async (values: LoginData) => {
    let redirect: string;
    try {
      const redirects = searchParams.getAll('redirect');
      redirect = requireAppRedirect(redirects.length > 1 ? redirects : redirects[0]);
    } catch {
      setRedirectError(true);
      return;
    }
    setRedirectError(false);
    setLoginError('');
    setLoading(true);
    try {
      const submitValues = form.getFieldsValue(true) as LoginData;
      if (values.rememberMe) {
        localStorage.setItem('username', values.username || '');
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        localStorage.removeItem('rememberMe');
      }
      await login(submitValues);
      navigate(redirect);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '登录失败，请重试');
      if (captchaEnabled) {
        await getCode();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthAuthorize = (provider: OAuthProviderOption) => {
    let redirect: string;
    try {
      const redirects = searchParams.getAll('redirect');
      redirect = toDeploymentRedirect(redirects.length > 1 ? redirects : redirects[0]);
    } catch {
      setRedirectError(true);
      return;
    }
    setRedirectError(false);
    const params = new URLSearchParams({ clientId: import.meta.env.VITE_APP_CLIENT_ID, redirect });
    setOauthLoadingProvider(provider.providerCode);
    window.location.assign(`${import.meta.env.VITE_APP_BASE_API}/auth/oauth/${provider.providerCode}/authorize?${params.toString()}`);
  };

  const renderProviderIcon = (providerCode: string) => {
    return providerCode === 'github' ? <GithubOutlined /> : <LoginOutlined />;
  };

  return (
    <AuthPageShell title={title}>
      {redirectError && <Alert type="error" showIcon title={t('login.invalidRedirect')} style={{ marginBottom: 16 }} />}
      {loginError && <Alert type="error" showIcon title={loginError} style={{ marginBottom: 16 }} />}
      <Form className="auth-login-form" form={form} onFinish={onFinish} initialValues={{ rememberMe: false }}>
        <Form.Item name="uuid" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="username" rules={[{ required: true, message: t('login.rule.username.required') }]} style={{ marginBottom: 22 }}>
          <Input
            size="large"
            placeholder={t('login.username')}
            autoComplete="username"
            prefix={<SvgIcon iconClass="user" size={14} style={authIconStyle} />}
          />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: t('login.rule.password.required') }]} style={{ marginBottom: 22 }}>
          <Input.Password
            size="large"
            placeholder={t('login.password')}
            autoComplete="current-password"
            prefix={<SvgIcon iconClass="password" size={14} style={authIconStyle} />}
            visibilityToggle={false}
            onPressEnter={() => form.submit()}
          />
        </Form.Item>
        {captchaEnabled && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 }}>
            <Form.Item name="code" rules={[{ required: true, message: t('login.rule.code.required') }]} style={{ width: '63%', marginBottom: 0 }}>
              <Input
                size="large"
                placeholder={t('login.code')}
                autoComplete="off"
                prefix={<SvgIcon iconClass="validCode" size={14} style={authIconStyle} />}
                onPressEnter={() => form.submit()}
              />
            </Form.Item>
            <div style={{ width: '33%', height: 40 }}>
              {codeUrl ? (
                <img
                  src={codeUrl}
                  alt={t('login.code')}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    paddingLeft: 12,
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                  onClick={getCode}
                />
              ) : null}
            </div>
          </div>
        )}
        <Form.Item name="rememberMe" valuePropName="checked" style={{ marginBottom: 25 }}>
          <Checkbox
            onChange={(event) => {
              if (!event.target.checked) {
                localStorage.removeItem('username');
                localStorage.removeItem('rememberMe');
                localStorage.removeItem('password');
              }
            }}
          >
            {t('login.rememberUsername')}
          </Checkbox>
        </Form.Item>
        <Form.Item style={{ marginBottom: 18 }}>
          <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 40 }}>
            {loading ? t('login.logging') : t('login.login')}
          </Button>
        </Form.Item>
        {(registerEnabled || forgotPasswordEnabled) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            {forgotPasswordEnabled && <Link to="/forgot-password">{t('login.switchForgotPasswordPage')}</Link>}
            {forgotPasswordEnabled && registerEnabled && <span style={{ color: '#bfbfbf' }}>|</span>}
            {registerEnabled && <Link to="/register">{t('login.switchRegisterPage')}</Link>}
          </div>
        )}
        {oauthProviders.length > 0 && (
          <>
            <Divider plain style={{ margin: '6px 0 14px' }}>
              {t('login.oauthDivider')}
            </Divider>
            <div style={{ display: 'grid', gap: 10 }}>
              {oauthProviders.map((provider) => (
                <Button
                  key={provider.providerCode}
                  block
                  icon={renderProviderIcon(provider.providerCode)}
                  loading={oauthLoadingProvider === provider.providerCode}
                  onClick={() => handleOAuthAuthorize(provider)}
                >
                  {t('login.oauthProvider', { provider: provider.providerName })}
                </Button>
              ))}
            </div>
          </>
        )}
      </Form>
    </AuthPageShell>
  );
}
