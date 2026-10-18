import { App, Button, Form, Input } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword, getCodeImg, sendEmailCode } from '@/api/login';
import type { ForgotPasswordForm } from '@/api/types';
import AuthPageShell from '@/components/AuthPageShell';
import SvgIcon from '@/components/SvgIcon';
import { useTranslation } from 'react-i18next';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export default function ForgotPasswordPage() {
  const [form] = Form.useForm<ForgotPasswordForm>();
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [captchaEnabled, setCaptchaEnabled] = useState(true);
  const [codeUrl, setCodeUrl] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const title = import.meta.env.VITE_APP_TITLE || t('login.title');
  const authIconStyle = { color: '#bfbfbf' };

  const getCode = useCallback(async () => {
    try {
      const res = await getCodeImg();
      const data = res?.data;
      if (!data?.forgotPasswordEnabled || !data.mailEnabled) {
        navigate('/login', { replace: true });
        return;
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
      newPassword: '',
      confirmPassword: '',
      code: '',
      uuid: ''
    });
    getCode();
  }, [form, getCode, title]);

  const countdownText =
    countdown > 0
      ? t('forgotPassword.countdown', { seconds: countdown })
      : sendingCode
        ? t('forgotPassword.sendingCode')
        : t('forgotPassword.sendCode');

  const handleSendCode = async () => {
    try {
      await form.validateFields(captchaEnabled ? ['email', 'code'] : ['email']);
    } catch {
      return;
    }

    const values = form.getFieldsValue(['email', 'code', 'uuid']);
    setSendingCode(true);
    try {
      await sendEmailCode({
        email: values.email,
        scene: 'forgot_password',
        code: values.code,
        uuid: values.uuid
      });
      message.success(t('forgotPassword.codeSent'));
      form.setFieldValue('code', '');
      setCountdown(60);
    } finally {
      setSendingCode(false);
      if (captchaEnabled) {
        await getCode();
      }
    }
  };

  const onFinish = async (values: ForgotPasswordForm) => {
    setLoading(true);
    try {
      await forgotPassword(values);
      message.success(t('forgotPassword.success'));
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

        <Form.Item
          name="email"
          style={{ marginBottom: 22 }}
          rules={[
            { required: true, message: t('forgotPassword.rule.email.required') },
            { type: 'email', message: t('forgotPassword.rule.email.invalid') }
          ]}
        >
          <Input
            size="large"
            autoComplete="email"
            placeholder={t('forgotPassword.email')}
            prefix={<SvgIcon iconClass="email" size={14} style={authIconStyle} />}
          />
        </Form.Item>

        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 132px', gap: 12, marginBottom: 22 }}>
          <Form.Item name="emailCode" style={{ marginBottom: 0 }} rules={[{ required: true, message: t('forgotPassword.rule.emailCode.required') }]}>
            <Input
              size="large"
              autoComplete="one-time-code"
              placeholder={t('forgotPassword.emailCode')}
              prefix={<SvgIcon iconClass="validCode" size={14} style={authIconStyle} />}
              onPressEnter={() => form.submit()}
            />
          </Form.Item>
          <Button size="large" loading={sendingCode} disabled={countdown > 0} onClick={handleSendCode}>
            {countdownText}
          </Button>
        </div>

        {captchaEnabled && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 }}>
            <Form.Item
              name="code"
              rules={[{ required: true, message: t('forgotPassword.rule.code.required') }]}
              style={{ width: '63%', marginBottom: 0 }}
            >
              <Input
                size="large"
                autoComplete="off"
                placeholder={t('login.code')}
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

        <Form.Item
          name="newPassword"
          style={{ marginBottom: 22 }}
          rules={[
            { required: true, message: t('forgotPassword.rule.newPassword.required') },
            { min: 8, max: 30, message: t('forgotPassword.rule.newPassword.length', { min: 8, max: 30 }) },
            { pattern: PASSWORD_REGEX, message: t('forgotPassword.rule.newPassword.pattern') }
          ]}
        >
          <Input.Password
            size="large"
            autoComplete="new-password"
            placeholder={t('forgotPassword.newPassword')}
            prefix={<SvgIcon iconClass="password" size={14} style={authIconStyle} />}
            visibilityToggle={false}
            onPressEnter={() => form.submit()}
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={['newPassword']}
          style={{ marginBottom: 22 }}
          rules={[
            { required: true, message: t('forgotPassword.rule.confirmPassword.required') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t('forgotPassword.rule.confirmPassword.equalToPassword')));
              }
            })
          ]}
        >
          <Input.Password
            size="large"
            autoComplete="new-password"
            placeholder={t('forgotPassword.confirmPassword')}
            prefix={<SvgIcon iconClass="password" size={14} style={authIconStyle} />}
            visibilityToggle={false}
            onPressEnter={() => form.submit()}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 40 }}>
            {loading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
          </Button>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Link to="/login">{t('forgotPassword.switchLoginPage')}</Link>
          </div>
        </Form.Item>
      </Form>
    </AuthPageShell>
  );
}
