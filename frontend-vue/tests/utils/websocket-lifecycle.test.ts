import { closeWebSocket, initWebSocket } from '@/utils/websocket';

vi.mock('@/utils/auth', () => ({ getToken: () => 'fixture-token' }));
vi.mock('@/store/modules/notice', () => ({ useNoticeStore: () => ({ refresh: vi.fn() }) }));

class SocketFixture {
  static sockets: SocketFixture[] = [];
  onopen?: () => void;
  onclose?: (event: Event) => void;
  onerror?: (event: Event) => void;
  onmessage?: (event: MessageEvent) => void;
  close = vi.fn(() => this.onclose?.(new Event('close')));
  send = vi.fn();
  constructor() {
    SocketFixture.sockets.push(this);
  }
}

describe('owned WebSocket lifecycle with VueUse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', SocketFixture);
    vi.stubEnv('VITE_APP_WEBSOCKET', 'true');
    SocketFixture.sockets = [];
  });

  afterEach(() => {
    closeWebSocket();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('cancels a scheduled reconnect after server disconnect', () => {
    initWebSocket('ws://localhost/fixture');
    const socket = SocketFixture.sockets[0];
    socket.onopen?.();
    socket.onclose?.(new Event('close'));
    closeWebSocket();
    vi.advanceTimersByTime(30000);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(SocketFixture.sockets).toHaveLength(1);
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('stops heartbeat and pong timers on owner close', () => {
    initWebSocket('ws://localhost/fixture');
    const socket = SocketFixture.sockets[0];
    socket.onopen?.();
    vi.advanceTimersByTime(10000);
    expect(socket.send).toHaveBeenCalledTimes(1);
    closeWebSocket();
    vi.advanceTimersByTime(30000);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(SocketFixture.sockets).toHaveLength(1);
  });
});
