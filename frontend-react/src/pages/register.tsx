import { App, Button, Form, Input } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkInviteCode, getCodeImg, register as registerApi, sendEmailCode } from '@/api/login';
import type { RegisterForm } from '@/api/types';
import AuthPageShell from '@/components/AuthPageShell';
import SvgIcon from '@/components/SvgIcon';
import { useTranslation } from 'react-i18next';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export default function RegisterPage() {
  const [form] = Form.useForm<RegisterForm>();
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [captchaEnabled, setCaptchaEnabled] = useState(true);
  const [codeUrl, setCodeUrl] = useState('');
  const [inviteRegisterEnabled, setInviteRegisterEnabled] = useState(false);
  const [inviteCodeValid, setInviteCodeValid] = useState(false);
  const [inviteChecking, setInviteChecking] = useState(false);
  const [lastValidatedInviteCode, setLastValidatedInviteCode] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const title = import.meta.env.VITE_APP_TITLE || t('login.title');
  const authIconStyle = { color: '#bfbfbf' };

  const getCode = useCallback(async () => {
    try {
      const res = await getCodeImg();
      const data = res?.data;
      if (!data?.registerEnabled || !data.mailEnabled) {
        navigate('/login', { replace: true });
        return;
      }
      const inviteEnabled = data.inviteRegisterEnabled === true;
      setInviteRegisterEnabled(inviteEnabled);
      if (!inviteEnabled) {
        setInviteCodeValid(false);
        setLastValidatedInviteCode('');
        form.setFieldValue('inviteCode', undefined);
      }
      const enabled = data.captchaEnabled === undefined ? true : data.captchaEnabled;
      setCaptchaEnabled(enabled);
      if (enabled) {
        setCodeUrl(`data:image/gif;base64,${data.img || ''}`);
        form.setFieldValue('uuid', data.uuid);
        form.setFieldValue('code', '');
        return;
      }
      setCodeUrl('');
      form.setFieldValue('uuid', undefined);
      form.setFieldValue('code', undefined);
    } catch {
      setCodeUrl('');
      form.setFieldValue('code', '');
      form.setFieldValue('uuid', undefined);
    }
  }, [form, navigate]);

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }
    const timerId = window.setTimeout(() => {
      setCountdown((value) => value - 1);
    }, 1000);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [countdown]);

  useEffect(() => {
    document.title = title;
    form.setFieldsValue({
      email: '',
      emailCode: '',
      inviteCode: '',
      username: '',
      password: '',
      confirmPassword: '',
      code: '',
      uuid: ''
    });
    getCode();
  }, [form, getCode, title]);

  const countdownText =
    countdown > 0 ? t('register.countdown', { seconds: countdown }) : sendingCode ? t('register.sendingCode') : t('register.sendCode');

  const handleInviteBlur = async () => {
    if (!inviteRegisterEnabled) {
      return;
    }
    const inviteCode = form.getFieldValue('inviteCode')?.trim();
    form.setFieldValue('inviteCode', inviteCode);
    if (!inviteCode) {
      setInviteCodeValid(false);
      setLastValidatedInviteCode('');
      return;
    }
    if (inviteCodeValid && lastValidatedInviteCode === inviteCode) {
      return;
    }
    setInviteChecking(true);
    try {
      await checkInviteCode(inviteCode);
      setInviteCodeValid(true);
      setLastValidatedInviteCode(inviteCode);
    } catch {
      setInviteCodeValid(false);
      setLastValidatedInviteCode('');
      await form.validateFields(['inviteCode']).catch(() => undefined);
    } finally {
      setInviteChecking(false);
    }
  };

  const handleInviteChange = () => {
    if (!inviteRegisterEnabled) {
      return;
    }
    setInviteCodeValid(false);
    setLastValidatedInviteCode('');
  };

  const handleSendCode = async () => {
    try {
      const fields = inviteRegisterEnabled ? ['inviteCode', 'email'] : ['email'];
      if (captchaEnabled) {
        fields.push('code');
      }
      await form.validateFields(fields);
    } catch {
      return;
    }

    if (inviteRegisterEnabled && !inviteCodeValid) {
      return;
    }

    const values = form.getFieldsValue(['inviteCode', 'email', 'code', 'uuid']);
    setSendingCode(true);
    try {
      await sendEmailCode({
        inviteCode: values.inviteCode,
        email: values.email,
        scene: 'register',
        code: values.code,
        uuid: values.uuid
      });
      message.success(t('register.codeSent'));
      form.setFieldValue('code', '');
      setCountdown(60);
    } finally {
      setSendingCode(false);
      if (captchaEnabled) {
        await getCode();
      }
    }
  };

  const onFinish = async (values: RegisterForm) => {
    if (inviteRegisterEnabled && !inviteCodeValid) {
      await form.validateFields(['inviteCode']).catch(() => undefined);
      return;
    }
    setLoading(true);
    try {
      await registerApi(values);
      message.success(t('register.registerSuccess', { username: values.username }));
      navigate('/login');
    } catch {
      if (captchaEnabled) {
        await getCode();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell title={title}>
      <Form form={form} onFinish={onFinish}>
        <Form.Item name="uuid" hidden>
          <Input />
        </Form.Item>

        {inviteRegisterEnabled && (
          <Form.Item
            name="inviteCode"
            style={{ marginBottom: 22 }}
            rules={[
              { required: true, message: t('register.rule.inviteCode.required') },
              {
                validator: async (_, value) => {
                  if (!inviteRegisterEnabled) {
                    return;
                  }
                  if (!value) {
                    throw new Error(t('register.rule.inviteCode.required'));
                  }
                  if (!inviteCodeValid) {
                    throw new Error(t('register.rule.inviteCode.invalid'));
                  }
                }
              }
            ]}
          >
            <Input
              size="large"
              autoComplete="off"
              placeholder={t('register.inviteCode')}
              prefix={<SvgIcon iconClass="password" size={14} style={authIconStyle} />}
              onBlur={handleInviteBlur}
              onChange={handleInviteChange}
            />
          </Form.Item>
        )}

        <Form.Item
          name="email"
          style={{ marginBottom: 22 }}
          rules={[
            { required: true, message: t('register.rule.email.required') },
            { type: 'email', message: t('register.rule.email.invalid') }
          ]}
        >
          <Input
            size="large"
            autoComplete="email"
            placeholder={t('register.email')}
            prefix={<SvgIcon iconClass="email" size={14} style={authIconStyle} />}
          />
        </Form.Item>

        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 132px', gap: 12, marginBottom: 22 }}>
          <Form.Item name="emailCode" style={{ marginBottom: 0 }} rules={[{ required: true, message: t('register.rule.emailCode.required') }]}>
            <Input
              size="large"
              autoComplete="one-time-code"
              placeholder={t('register.emailCode')}
              prefix={<SvgIcon iconClass="validCode" size={14} style={authIconStyle} />}
              onPressEnter={() => form.submit()}
            />
          </Form.Item>
          <Button size="large" loading={sendingCode} disabled={countdown > 0 || (inviteRegisterEnabled && (inviteChecking || !inviteCodeValid))} onClick={handleSendCode}>
            {countdownText}
          </Button>
        </div>

        {captchaEnabled && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 }}>
            <Form.Item name="code" rules={[{ required: true, message: t('register.rule.code.required') }]} style={{ width: '63%', marginBottom: 0 }}>
              <Input
                size="large"
                autoComplete="off"
                placeholder={t('register.code')}
                prefix={<SvgIcon iconClass="validCode" size={14} style={authIconStyle} />}
                onPressEnter={() => form.submit()}
              />
            </Form.Item>
            <div style={{ width: '33%', height: 40 }}>
              {codeUrl ? (
                <img
                  src={codeUrl}
                  alt={t('register.code')}
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

        <Form.Item
          name="username"
          style={{ marginBottom: 22 }}
          rules={[
            { required: true, message: t('register.rule.username.required') },
            { min: 2, max: 20, message: t('register.rule.username.length', { min: 2, max: 20 }) }
          ]}
        >
          <Input
            size="large"
            autoComplete="username"
            placeholder={t('register.username')}
            prefix={<SvgIcon iconClass="user" size={14} style={authIconStyle} />}
          />
        </Form.Item>

        <Form.Item
          name="password"
          style={{ marginBottom: 22 }}
          rules={[
            { required: true, message: t('register.rule.password.required') },
            { min: 8, max: 30, message: t('register.rule.password.length', { min: 8, max: 30 }) },
            { pattern: PASSWORD_REGEX, message: t('register.rule.password.pattern') }
          ]}
        >
          <Input.Password
            size="large"
            autoComplete="new-password"
            placeholder={t('register.password')}
            prefix={<SvgIcon iconClass="password" size={14} style={authIconStyle} />}
            visibilityToggle={false}
            onPressEnter={() => form.submit()}
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          style={{ marginBottom: 22 }}
          rules={[
            { required: true, message: t('register.rule.confirmPassword.required') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t('register.rule.confirmPassword.equalToPassword')));
              }
            })
          ]}
        >
          <Input.Password
            size="large"
            autoComplete="new-password"
            placeholder={t('register.confirmPassword')}
            prefix={<SvgIcon iconClass="password" size={14} style={authIconStyle} />}
            visibilityToggle={false}
            onPressEnter={() => form.submit()}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 40 }}>
            {loading ? t('register.registering') : t('register.register')}
          </Button>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Link to="/login">{t('register.switchLoginPage')}</Link>
          </div>
        </Form.Item>
      </Form>
    </AuthPageShell>
  );
}
