import { nextTick, ref } from 'vue';
import { closeSSE, initSSE } from '@/utils/sse';

const sseMocks = vi.hoisted(() => {
  return {
    useEventSource: vi.fn(),
    getToken: vi.fn(),
    refresh: vi.fn()
  };
});

vi.mock('@vueuse/core', () => ({
  useEventSource: sseMocks.useEventSource
}));

vi.mock('@/utils/auth', () => ({
  getToken: sseMocks.getToken
}));

vi.mock('@/store/modules/notice', () => ({
  useNoticeStore: vi.fn(() => ({
    refresh: sseMocks.refresh
  }))
}));

describe('utils/sse', () => {
  beforeEach(() => {
    closeSSE();
    vi.clearAllMocks();
    (import.meta.env as Record<string, string>).VITE_APP_SSE = 'true';
    (import.meta.env as Record<string, string>).VITE_APP_CLIENT_ID = 'test-client-id';
  });

  afterEach(() => {
    closeSSE();
  });

  it('skips initialization when sse switch is disabled or token is missing', () => {
    (import.meta.env as Record<string, string>).VITE_APP_SSE = 'false';
    sseMocks.getToken.mockReturnValue('token-a');
    initSSE('/system/sse');
    expect(sseMocks.useEventSource).not.toHaveBeenCalled();

    (import.meta.env as Record<string, string>).VITE_APP_SSE = 'true';
    sseMocks.getToken.mockReturnValue('');
    initSSE('/system/sse');
    expect(sseMocks.useEventSource).not.toHaveBeenCalled();
  });

  it('initializes sse and refreshes persisted messages only for structured events', async () => {
    const data = ref<string | null>(null);
    const error = ref<unknown>(null);
    const close = vi.fn();
    sseMocks.getToken.mockReturnValue('token-a');
    sseMocks.useEventSource.mockReturnValue({
      data,
      error,
      close
    });

    initSSE('/system/sse');

    expect(sseMocks.useEventSource).toHaveBeenCalledWith(
      '/system/sse?Authorization=Bearer token-a&clientid=test-client-id',
      [],
      expect.objectContaining({
        autoReconnect: expect.objectContaining({
          retries: 5,
          delay: 5000
        })
      })
    );
    const connectOptions = sseMocks.useEventSource.mock.calls[0][2] as {
      autoReconnect: { onFailed: () => void };
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    error.value = new Event('error');
    await nextTick();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(error.value).toBeNull();

    data.value = '系统消息';
    await nextTick();
    expect(sseMocks.refresh).not.toHaveBeenCalled();

    data.value = JSON.stringify({ type: 'message' });
    await nextTick();
    expect(sseMocks.refresh).toHaveBeenCalledTimes(1);

    data.value = JSON.stringify({ type: 'ping' });
    await nextTick();
    expect(sseMocks.refresh).toHaveBeenCalledTimes(1);
    expect(data.value).toBeNull();

    connectOptions.autoReconnect.onFailed();
    expect(errorSpy).toHaveBeenCalledWith('Failed to connect after 5 retries');
    errorSpy.mockRestore();

    closeSSE();
    expect(close).toHaveBeenCalled();
  });

  it('reuses existing connection for same url and reconnects when token changes', () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    let currentToken = 'token-a';
    sseMocks.getToken.mockImplementation(() => currentToken);
    sseMocks.useEventSource
      .mockReturnValueOnce({ data: ref(null), error: ref(null), close: firstClose })
      .mockReturnValueOnce({ data: ref(null), error: ref(null), close: secondClose });

    initSSE('/system/sse');
    initSSE('/system/sse');
    expect(sseMocks.useEventSource).toHaveBeenCalledTimes(1);

    currentToken = 'token-b';
    initSSE('/system/sse');
    expect(firstClose).toHaveBeenCalledTimes(1);
    expect(sseMocks.useEventSource).toHaveBeenCalledTimes(2);
  });
});
