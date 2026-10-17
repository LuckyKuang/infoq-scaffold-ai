import { getToken } from '@/utils/auth';
import { useNoticeStore } from '@/store/modules/notice';

let eventSource: EventSource | null = null;
let activeUrl = '';

const isEnabled = () => import.meta.env.VITE_APP_SSE === 'true';

const buildSSEUrl = (baseUrl: string) => {
  return `${baseUrl}?Authorization=Bearer ${getToken()}&clientid=${import.meta.env.VITE_APP_CLIENT_ID}`;
};

export const closeSSE = () => {
  eventSource?.close();
  eventSource = null;
  activeUrl = '';
};

export const initSSE = (baseUrl: string) => {
  if (!isEnabled()) {
    closeSSE();
    return;
  }

  const token = getToken();
  if (!token) {
    closeSSE();
    return;
  }

  const nextUrl = buildSSEUrl(baseUrl);
  if (activeUrl === nextUrl && eventSource) {
    return;
  }

  closeSSE();

  eventSource = new EventSource(nextUrl);
  activeUrl = nextUrl;

  eventSource.onmessage = (evt) => {
    if (!evt.data) {
      return;
    }
    try {
      const event = JSON.parse(evt.data) as { type?: string };
      if (event.type === 'message') {
        void useNoticeStore.getState().refresh();
      }
    } catch {
      // 只处理结构化消息刷新事件，其他 SSE 载荷不进入个人消息盒子。
    }
  };

  eventSource.onerror = () => {
    // 浏览器会自动重连，保持静默
  };
};
