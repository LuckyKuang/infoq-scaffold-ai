import { useEffect, useMemo } from 'react';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import App from '@/App';
import AntdAppBridge from '@/components/AntdAppBridge';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAppStore } from '@/store/modules/app';
import { useSettingsStore } from '@/store/modules/settings';

export default function RootProviders() {
  const language = useAppStore((state) => state.language);
  const size = useAppStore((state) => state.size);
  const dark = useSettingsStore((state) => state.dark);
  const primary = useSettingsStore((state) => state.theme);
  const antdTheme = useMemo(
    () => ({
      token: {
        colorPrimary: primary,
        borderRadius: 8,
        borderRadiusLG: 12,
        fontFamily: 'Helvetica Neue, Helvetica, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Arial, sans-serif',
        ...(dark ? {} : { colorBgLayout: '#f5f7f9' })
      },
      algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm
    }),
    [dark, primary]
  );
  const designToken = useMemo(() => theme.getDesignToken(antdTheme), [antdTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.themeMode = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--current-color', primary);
    document.documentElement.style.setProperty('--table-header-bg', dark ? designToken.colorBgContainer : '#f8f8f9');
    document.documentElement.style.setProperty('--table-header-text', dark ? designToken.colorText : '#515a6e');
    document.documentElement.style.setProperty('--btn-primary-bg', dark ? designToken.colorPrimaryBg : designToken.colorPrimary);
    document.documentElement.style.setProperty('--btn-primary-border', dark ? designToken.colorPrimaryBorder : designToken.colorPrimary);
    document.documentElement.style.setProperty('--btn-primary-hover-bg', dark ? designToken.colorPrimaryBgHover : designToken.colorPrimaryHover);
    document.documentElement.style.setProperty('--btn-primary-hover-border', dark ? designToken.colorPrimaryBorderHover : designToken.colorPrimaryHover);
    document.body.style.backgroundColor = designToken.colorBgLayout;
    document.body.style.color = designToken.colorText;
    document.body.style.fontFamily = 'Helvetica Neue, Helvetica, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Arial, sans-serif';
  }, [
    dark,
    designToken.colorBgContainer,
    designToken.colorBgLayout,
    designToken.colorPrimary,
    designToken.colorPrimaryBg,
    designToken.colorPrimaryBgHover,
    designToken.colorPrimaryBorder,
    designToken.colorPrimaryBorderHover,
    designToken.colorPrimaryHover,
    designToken.colorText,
    primary
  ]);

  return (
    <ConfigProvider componentSize={size} locale={language === 'en_US' ? enUS : zhCN} theme={antdTheme} form={{ colon: false }}>
      <ErrorBoundary>
        <AntdApp>
          <AntdAppBridge />
          <App />
        </AntdApp>
      </ErrorBoundary>
    </ConfigProvider>
  );
}
