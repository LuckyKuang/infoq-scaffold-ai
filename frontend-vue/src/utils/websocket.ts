import { getToken } from '@/utils/auth';
import { useNoticeStore } from '@/store/modules/notice';

// 初始化socket
export const initWebSocket = (url: string) => {
  if (import.meta.env.VITE_APP_WEBSOCKET === 'false') {
    return;
  }
  url = url + '?Authorization=Bearer ' + getToken() + '&clientid=' + import.meta.env.VITE_APP_CLIENT_ID;
  useWebSocket(url, {
    autoReconnect: {
      // 重连最大次数
      retries: 3,
      // 重连间隔
      delay: 1000,
      onFailed() {
        console.error('websocket重连失败');
      }
    },
    heartbeat: {
      message: JSON.stringify({ type: 'ping' }),
      // 发送心跳的间隔
      interval: 10000,
      // 接收到心跳response的超时时间
      pongTimeout: 2000
    },
    onMessage: (_, e) => {
      if (typeof e.data === 'string' && e.data.indexOf('ping') >= 0) {
        return;
      }
      try {
        const event = JSON.parse(String(e.data)) as { type?: string };
        if (event.type === 'message') {
          void useNoticeStore().refresh();
        }
      } catch {
        // 只处理结构化消息刷新事件，其他 WebSocket 载荷不进入个人消息盒子。
      }
    }
  });
};
