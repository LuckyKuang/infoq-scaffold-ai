import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { theme } from 'antd';
import LangSelect from '@/components/LangSelect';
import loginBackground from '@/assets/images/login-background.jpg';
import { useSettingsStore } from '@/store/modules/settings';

type AuthPageShellProps = {
  title: string;
  children: ReactNode;
};

export default function AuthPageShell({ title, children }: AuthPageShellProps) {
  const dark = useSettingsStore((state) => state.dark);
  const { token } = theme.useToken();
  const cardStyle = useMemo<CSSProperties>(
    () => ({
      width: 400,
      maxWidth: '100%',
      padding: '25px 25px 5px',
      borderRadius: 6,
      zIndex: 1,
      background: dark ? 'rgb(15 20 27 / 90%)' : token.colorBgElevated,
      border: `1px solid ${dark ? 'rgb(255 255 255 / 14%)' : 'rgb(255 255 255 / 72%)'}`,
      boxShadow: dark ? '0 20px 50px rgb(0 0 0 / 55%)' : '0 16px 40px rgb(0 0 0 / 14%)',
      backdropFilter: dark ? 'blur(10px)' : undefined
    }),
    [dark, token.colorBgElevated]
  );

  const titleStyle = useMemo<CSSProperties>(
    () => ({
      margin: '0 auto 30px auto',
      flex: 1,
      textAlign: 'center',
      color: dark ? token.colorTextHeading : '#707070',
      fontWeight: 700
    }),
    [dark, token.colorTextHeading]
  );

  const languageStyle = useMemo<CSSProperties>(
    () => ({
      lineHeight: 0,
      color: dark ? token.colorTextSecondary : '#7483a3',
      marginLeft: 12
    }),
    [dark, token.colorTextSecondary]
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
        backgroundImage: `url(${loginBackground})`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover'
      }}
    >
      <div style={cardStyle}>
        <div style={{ display: 'flex' }}>
          <h3 style={titleStyle}>{title}</h3>
          <div style={languageStyle}>
            <LangSelect />
          </div>
        </div>
        {children}
      </div>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: 40,
          lineHeight: '40px',
          textAlign: 'center',
          color: '#ffffff',
          fontFamily: 'Arial, serif',
          fontSize: 12,
          letterSpacing: 1
        }}
      >
        Copyright © 2018-2026 Pontus All Rights Reserved.
      </div>
    </div>
  );
}
