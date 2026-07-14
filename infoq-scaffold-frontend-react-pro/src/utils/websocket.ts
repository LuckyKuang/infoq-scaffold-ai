import {useNoticeStore} from '@/store/modules/notice';
import {getToken} from '@/utils/auth';

let ws: WebSocket | null = null;
let heartBeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let activeBaseUrl = '';
let activeTargetUrl = '';

const clearTimers = () => {
  if (heartBeatTimer) {
    clearInterval(heartBeatTimer);
    heartBeatTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const scheduleReconnect = () => {
  if (!activeBaseUrl) {
    return;
  }
  if (reconnectTimer) {
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initWebSocket(activeBaseUrl);
  }, 3000);
};

const closeSocket = () => {
  clearTimers();
  const socket = ws;
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
  }
  ws = null;
};

export const initWebSocket = (url: string) => {
  if (import.meta.env.VITE_APP_WEBSOCKET === 'false') {
    closeSocket();
    return;
  }

  const token = getToken();
  if (!token) {
    closeSocket();
    return;
  }

  const targetUrl = `${url}?Authorization=Bearer ${token}&clientid=${import.meta.env.VITE_APP_CLIENT_ID}`;
  if (activeTargetUrl === targetUrl && ws) {
    return;
  }

  activeBaseUrl = url;
  activeTargetUrl = targetUrl;
  closeSocket();
  ws = new WebSocket(targetUrl);

  ws.onopen = () => {
    heartBeatTimer = setInterval(() => {
      ws?.send(JSON.stringify({ type: 'ping' }));
    }, 10000);
  };

  ws.onmessage = (evt) => {
    if (typeof evt.data === 'string' && evt.data.includes('ping')) {
      return;
    }
    try {
      const event = JSON.parse(String(evt.data)) as { type?: string };
      if (event.type === 'message') {
        void useNoticeStore.getState().refresh();
      }
    } catch {
      // 只处理结构化消息刷新事件，其他 WebSocket 载荷不进入个人消息盒子。
    }
  };

  ws.onerror = () => {
    scheduleReconnect();
  };

  ws.onclose = () => {
    clearTimers();
    ws = null;
    activeTargetUrl = '';
    scheduleReconnect();
  };
};

export const closeWebSocket = () => {
  activeBaseUrl = '';
  activeTargetUrl = '';
  closeSocket();
};
