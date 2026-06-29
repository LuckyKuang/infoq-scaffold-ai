import { useNoticeStore } from '@/store/modules/notice';
import { getToken } from '@/utils/auth';
import modal from '@/utils/modal';

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
    useNoticeStore.getState().addNotice({
      message: evt.data,
      read: false,
      time: new Date().toLocaleString(),
    });
    modal.notifySuccess({
      title: '消息',
      description: evt.data,
      duration: 3,
    });
  };

  eventSource.onerror = () => {
    // 浏览器会自动重连，保持静默
  };
};
