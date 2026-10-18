import { type ReactElement, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button, Result, Spin } from 'antd';
import { isWhiteListRoute } from '@/router/public-routes';
import { useUserStore } from '@/store/modules/user';

type AuthGuardProps = { children: ReactElement };

export default function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation();
  const sessionState = useUserStore((state) => state.sessionState);
  const sessionError = useUserStore((state) => state.sessionError);
  const ready = useUserStore((state) => state.bootstrapReady);
  const token = useUserStore((state) => state.token);
  const logoutState = useUserStore((state) => state.logoutState);
  const isPublic = isWhiteListRoute(location.pathname);
  const redirectTarget = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (!isPublic && logoutState === 'idle')
      void useUserStore
        .getState()
        .bootstrapSession()
        .catch(() => {
          /* 错误由状态面板呈现，可显式重试。 */
        });
  }, [isPublic, token, logoutState]);

  if (logoutState === 'pending')
    return (
      <div role="status">
        <Spin />
        正在退出，请稍候
      </div>
    );
  if (logoutState === 'failed') {
    return (
      <Result
        status="error"
        title="退出未完成"
        subTitle={sessionError}
        extra={
          <Button
            onClick={() =>
              void useUserStore
                .getState()
                .logout()
                .catch(() => {})
            }
          >
            重试退出
          </Button>
        }
      />
    );
  }
  if (isPublic) return children;
  if (sessionState === 'failed') {
    return (
      <Result
        status="error"
        title="会话初始化失败"
        subTitle={sessionError}
        extra={
          <Button
            onClick={() =>
              void useUserStore
                .getState()
                .bootstrapSession(true)
                .catch(() => {})
            }
          >
            重试
          </Button>
        }
      />
    );
  }
  if (sessionState === 'anonymous') {
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }
  if (!ready) return <Spin />;
  return children;
}
