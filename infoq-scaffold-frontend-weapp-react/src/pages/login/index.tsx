import {Image, Text, View} from '@tarojs/components';
import Taro, {useLoad} from '@tarojs/taro';
import {useState} from 'react';
import {AtButton, AtInput, AtSwitch} from 'taro-ui';
import {
  asCaptchaImage,
  getCodeImg,
  getRememberedLogin,
  getWechatMiniAppEnabled,
  mobileEnv,
  setRememberedLogin
} from '@/api';
import {routes} from '../../utils/navigation';
import {handlePageError} from '../../utils/ui';
import {useSessionStore} from '../../store/session';
import './index.scss';

export default function LoginPage() {
  const signIn = useSessionStore((state) => state.signIn);
  const [form, setForm] = useState({
    username: '',
    password: '',
    rememberMe: false,
    code: '',
    uuid: ''
  });
  const [codeUrl, setCodeUrl] = useState('');
  const [captchaEnabled, setCaptchaEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wechatLoginEnabled, setWechatLoginEnabled] = useState(false);
  const isWeappRuntime = mobileEnv.taroEnv === 'weapp';

  const loadCaptcha = async () => {
    try {
      const response = await getCodeImg();
      const data = response.data;
      const enabled = data.captchaEnabled === undefined ? true : data.captchaEnabled;
      setCaptchaEnabled(enabled);
      if (enabled) {
        setCodeUrl(await asCaptchaImage(data.img, data.uuid));
        setForm((prev) => ({
          ...prev,
          code: '',
          uuid: data.uuid || ''
        }));
      } else {
        setCodeUrl('');
      }
    } catch (error) {
      setCodeUrl('');
      await handlePageError(error, '验证码获取失败。');
    }
  };

  useLoad(() => {
    if (useSessionStore.getState().token) {
      Taro.reLaunch({ url: routes.home });
      return;
    }
    const rememberedLogin = getRememberedLogin();
    setForm((prev) => ({
      ...prev,
      username: rememberedLogin.username,
      password: rememberedLogin.password,
      rememberMe: rememberedLogin.rememberMe
    }));
    void loadCaptcha();
    if (isWeappRuntime) {
      void getWechatMiniAppEnabled().then((response) => setWechatLoginEnabled(response.data)).catch(() => setWechatLoginEnabled(false));
    }
  });

  const handleSubmit = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      await Taro.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }
    if (captchaEnabled && !form.code.trim()) {
      await Taro.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await signIn(form);
      if (form.rememberMe) {
        setRememberedLogin({
          username: form.username.trim(),
          password: form.password,
          rememberMe: form.rememberMe
        });
      } else {
        setRememberedLogin({
          username: '',
          password: '',
          rememberMe: false
        });
      }
      await Taro.showToast({ title: '登录成功', icon: 'success' });
      Taro.reLaunch({ url: routes.home });
    } catch (error) {
      await handlePageError(error, '登录失败，请检查账号信息');
      if (captchaEnabled) {
        await loadCaptcha();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleWechatLogin = async () => {
    setSubmitting(true);
    try {
      const result = await Taro.login();
      if (!result.code) {
        throw new Error('未获取到微信授权 code');
      }
      await signIn({ clientId: mobileEnv.clientId, grantType: 'miniapp', code: result.code });
      await Taro.showToast({ title: '登录成功', icon: 'success' });
      Taro.reLaunch({ url: routes.home });
    } catch (error) {
      await handlePageError(error, '微信登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="login-container">
      <View className="login-logo-section">
        <Text className="logo-text">InfoQ</Text>
        <Text className="logo-desc">AI-first Full-stack Scaffold</Text>
      </View>

      <View className="login-card">
        <View className="login-title">用户登录</View>
        <View className="login-form">
          <View className="form-item">
            <AtInput
              clear
              name="username"
              placeholder="请输入用户名"
              title="用户名"
              value={form.username}
              onChange={(value) => {
                setForm((prev) => ({ ...prev, username: String(value) }));
                return value;
              }}
            />
          </View>
          <View className="form-item">
            <AtInput
              clear
              name="password"
              placeholder="请输入密码"
              title="密码"
              type="password"
              value={form.password}
              onChange={(value) => {
                setForm((prev) => ({ ...prev, password: String(value) }));
                return value;
              }}
            />
          </View>
          {captchaEnabled && (
            <View className="form-item">
              <View className="captcha-container">
                <AtInput
                  clear
                  name="code"
                  placeholder="验证码"
                  title="验证码"
                  value={form.code}
                  onChange={(value) => {
                    setForm((prev) => ({ ...prev, code: String(value) }));
                    return value;
                  }}
                />
                {codeUrl ? (
                  <Image className="captcha-image" src={codeUrl} onClick={() => void loadCaptcha()} />
                ) : null}
              </View>
            </View>
          )}
          <View className="remember-me">
            <AtSwitch
              checked={form.rememberMe}
              title="记住密码"
              onChange={(value) => setForm((prev) => ({ ...prev, rememberMe: value }))}
            />
          </View>
          <AtButton
            className="submit-btn"
            loading={submitting}
            type="primary"
            onClick={() => void handleSubmit()}
          >
            登 录
          </AtButton>
          {isWeappRuntime && wechatLoginEnabled && (
            <AtButton className="submit-btn" loading={submitting} onClick={() => void handleWechatLogin()}>
              微信小程序登录
            </AtButton>
          )}
        </View>
      </View>

      <View className="login-footer">
        <Text className="copyright">{mobileEnv.copyright}</Text>
      </View>
    </View>
  );
}
