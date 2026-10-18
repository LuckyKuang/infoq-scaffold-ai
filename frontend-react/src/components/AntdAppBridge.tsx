import { App } from 'antd';
import { useEffect } from 'react';
import { registerModalRuntime } from '@/utils/modal';

export default function AntdAppBridge() {
  const { message, modal, notification } = App.useApp();

  useEffect(() => {
    registerModalRuntime({
      message,
      modal,
      notification
    });
  }, [message, modal, notification]);

  return null;
}
