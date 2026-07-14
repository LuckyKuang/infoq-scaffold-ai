import {notification} from 'antd';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useNoticeStore} from '@/store/modules/notice';
import {closeSSE, initSSE} from '@/utils/sse';
import {closeWebSocket, initWebSocket} from '@/utils/websocket';

const messageApi = vi.hoisted(() => ({
  deleteMessages: vi.fn(),
  getUnreadMessageCount: vi.fn(),
  listMessages: vi.fn(),
  markAllMessagesRead: vi.fn(),
  markMessageRead: vi.fn(),
}));

vi.mock('@/api/system/message', () => messageApi);

const mockMessageRefresh = (content: string) => {
  messageApi.listMessages.mockResolvedValueOnce({
    rows: [
      {
        messageId: 1,
        messageType: 'system',
        messageLevel: 'normal',
        title: 'System message',
        content,
        source: 'test',
        createTime: '2026-07-14 00:00:00',
      },
    ],
    total: 1,
  });
  messageApi.getUnreadMessageCount.mockResolvedValueOnce({ data: 1 });
};

const waitForStoreRefresh = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

class MockEventSource {
  static instances: MockEventSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  url: string;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

describe('utils/realtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv('VITE_APP_CLIENT_ID', 'test-client');
    vi.stubEnv('VITE_APP_SSE', 'true');
    vi.stubEnv('VITE_APP_WEBSOCKET', 'true');

    localStorage.setItem('Admin-Token', 'token-test');
    useNoticeStore.setState({ notices: [], unreadCount: 0 });
    MockEventSource.instances = [];
    MockWebSocket.instances = [];

    vi.stubGlobal('EventSource', MockEventSource);
    vi.stubGlobal('WebSocket', MockWebSocket);

    vi.spyOn(notification, 'success').mockImplementation(() => {
      return undefined as never;
    });
  });

  afterEach(() => {
    closeSSE();
    closeWebSocket();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('refreshes persistent notices after an SSE message event', async () => {
    initSSE('/resource/sse');
    expect(MockEventSource.instances).toHaveLength(1);

    const instance = MockEventSource.instances[0];
    expect(instance.url).toContain('Authorization=Bearer token-test');

    mockMessageRefresh('new message');
    instance.onmessage?.({
      data: JSON.stringify({ type: 'message' }),
    } as MessageEvent<string>);

    await waitForStoreRefresh();
    expect(useNoticeStore.getState().notices[0]?.content).toBe('new message');
    expect(messageApi.getUnreadMessageCount).toHaveBeenCalledOnce();

    closeSSE();
    expect(instance.close).toHaveBeenCalled();
  });

  it('refreshes persistent notices after a websocket message event', async () => {
    initWebSocket('/resource/ws');
    expect(MockWebSocket.instances).toHaveLength(1);

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain('Authorization=Bearer token-test');

    ws.onopen?.();
    vi.advanceTimersByTime(10000);
    expect(ws.send).toHaveBeenCalled();

    mockMessageRefresh('biz-message');
    ws.onmessage?.({
      data: JSON.stringify({ type: 'message' }),
    } as MessageEvent<string>);

    await waitForStoreRefresh();
    expect(useNoticeStore.getState().notices[0]?.content).toBe('biz-message');
    expect(messageApi.getUnreadMessageCount).toHaveBeenCalledOnce();

    closeWebSocket();
    expect(ws.close).toHaveBeenCalled();
  });

  it('reconnects websocket after an unexpected close', () => {
    initWebSocket('/resource/ws');
    expect(MockWebSocket.instances).toHaveLength(1);

    MockWebSocket.instances[0].onclose?.();
    vi.advanceTimersByTime(3000);

    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
