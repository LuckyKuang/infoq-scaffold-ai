import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Button, Result } from 'antd';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 保留日志便于排查运行时异常
    console.error('App render error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title="页面异常"
          subTitle="页面渲染出现异常，请重试或联系管理员。"
          extra={
            <Button
              type="primary"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
            >
              刷新页面
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}
