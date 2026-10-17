import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { Spin } from 'antd';
import { setNavigator } from '@/utils/router-utils';

const AuthGuard = lazy(() => import('@/router/AuthGuard'));
const MainLayout = lazy(() => import('@/layouts/MainLayout'));
const BackendRouteView = lazy(() => import('@/router/BackendRouteView'));
const LoginPage = lazy(() => import('@/pages/login'));
const OAuthCallbackPage = lazy(() => import('@/pages/oauth-callback'));
const RegisterPage = lazy(() => import('@/pages/register'));
const ForgotPasswordPage = lazy(() => import('@/pages/forgot-password'));
const RedirectPage = lazy(() => import('@/pages/redirect/index'));
const Error401Page = lazy(() => import('@/pages/error/401'));
const HomePage = lazy(() => import('@/pages/index'));
const MessageCenterPage = lazy(() => import('@/pages/message-center'));
const Error404Page = lazy(() => import('@/pages/error/404'));

NProgress.configure({ showSpinner: false });

function RouterEffects() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setNavigator((path: string) => navigate(path));
  }, [navigate]);

  useEffect(() => {
    NProgress.start();
    const frameId = window.requestAnimationFrame(() => {
      NProgress.done();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      NProgress.done();
    };
  }, [location.key]);

  return null;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <RouterEffects />
      <Suspense fallback={<Spin />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/401" element={<Error401Page />} />
          <Route path="/redirect/*" element={<RedirectPage />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <MainLayout />
              </AuthGuard>
            }
          >
            <Route index element={<Navigate to="/index" replace />} />
            <Route path="index" element={<HomePage />} />
            <Route path="message-center" element={<MessageCenterPage />} />
            <Route path="user/profile" element={<BackendRouteView />} />
            <Route path="*" element={<BackendRouteView />} />
          </Route>
          <Route path="*" element={<Error404Page />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
