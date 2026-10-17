import { type ReactElement, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { getToken } from '@/utils/auth';
import { isWhiteListRoute } from '@/router/public-routes';
import { useUserStore } from '@/store/modules/user';
import { usePermissionStore } from '@/store/modules/permission';
import modal from '@/utils/modal';

type AuthGuardProps = {
  children: ReactElement;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const token = getToken();
  const roles = useUserStore((state) => state.roles);
  const redirectTarget = `${location.pathname}${location.search}`;

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      if (!token) {
        if (!disposed) {
          setBootstrapFailed(false);
          setLoading(false);
        }
        return;
      }

      try {
        if (!roles || roles.length === 0) {
          await useUserStore.getState().getInfo();
          await usePermissionStore.getState().generateRoutes();
        }
        useUserStore.getState().initializeRealtimeChannels();
        if (!disposed) {
          setBootstrapFailed(false);
        }
      } catch (error) {
        if (!disposed) {
          setBootstrapFailed(true);
        }
        modal.msgError(error);
        try {
          await useUserStore.getState().logout();
        } catch (logoutError) {
          modal.msgError(logoutError);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    bootstrap();
    return () => {
      disposed = true;
    };
  }, [token, roles]);

  if (!token || bootstrapFailed) {
    if (isWhiteListRoute(location.pathname)) {
      return children;
    }
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  if (loading) {
    return <Spin />;
  }

  return children;
}
