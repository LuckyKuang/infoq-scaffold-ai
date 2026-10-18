import { Result, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthPageShell from '@/components/AuthPageShell';
import { useUserStore } from '@/store/modules/user';
import { useTranslation } from 'react-i18next';
import { requireAppRedirect } from '@/utils/auth-redirect';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loginByOAuthTicket = useUserStore((state) => state.loginByOAuthTicket);
  const { t } = useTranslation();
  const executedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (executedRef.current) {
      return;
    }
    executedRef.current = true;
    const error = searchParams.get('error');
    const loginTicket = searchParams.get('loginTicket');
    if (error) {
      setErrorMessage(searchParams.get('message') || t('oauthCallback.failed'));
      return;
    }
    if (!loginTicket) {
      setErrorMessage(t('oauthCallback.missingTicket'));
      return;
    }
    let redirect: string;
    try {
      const redirects = searchParams.getAll('redirect');
      redirect = requireAppRedirect(redirects.length > 1 ? redirects : redirects[0]);
    } catch {
      setErrorMessage(t('login.invalidRedirect'));
      return;
    }
    loginByOAuthTicket(loginTicket)
      .then(() => {
        navigate(redirect, { replace: true });
      })
      .catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : t('oauthCallback.failed'));
      });
  }, [loginByOAuthTicket, navigate, searchParams, t]);

  return (
    <AuthPageShell title={import.meta.env.VITE_APP_TITLE || t('login.title')}>
      {errorMessage ? (
        <Result
          status="error"
          title={t('oauthCallback.failedTitle')}
          subTitle={errorMessage}
          extra={<Link to="/login">{t('oauthCallback.backToLogin')}</Link>}
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <Spin description={t('oauthCallback.processing')} />
        </div>
      )}
    </AuthPageShell>
  );
}
