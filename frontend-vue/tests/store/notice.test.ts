import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const messageMocks = vi.hoisted(() => ({
  deleteMessages: vi.fn(),
  getUnreadMessageCount: vi.fn(),
  listMessages: vi.fn(),
  markAllMessagesRead: vi.fn(),
  markMessageRead: vi.fn()
}));

vi.mock('@/api/system/message', () => messageMocks);

const { useNoticeStore } = await import('@/store/modules/notice');

describe('store/notice', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('refreshes the persisted inbox and unread count from the server', async () => {
    const store = useNoticeStore();
    messageMocks.listMessages.mockResolvedValue({
      rows: [{ messageId: 101, title: 'Notice title', content: 'Notice body', read: false }],
      total: 1
    });
    messageMocks.getUnreadMessageCount.mockResolvedValue({ data: 3 });

    await store.refresh(20);

    expect(messageMocks.listMessages).toHaveBeenCalledWith({ pageNum: 1, pageSize: 20 });
    expect(messageMocks.getUnreadMessageCount).toHaveBeenCalledTimes(1);
    expect(store.state).toMatchObject({
      unreadCount: 3,
      loading: false,
      notices: [{ messageId: 101, title: 'Notice title' }]
    });
  });

  it('marks a message as read and then refreshes the server truth', async () => {
    const store = useNoticeStore();
    messageMocks.markMessageRead.mockResolvedValue(undefined);
    messageMocks.listMessages.mockResolvedValue({ rows: [], total: 0 });
    messageMocks.getUnreadMessageCount.mockResolvedValue({ data: 0 });

    await store.markRead(101);

    expect(messageMocks.markMessageRead).toHaveBeenCalledWith(101);
    expect(messageMocks.listMessages).toHaveBeenCalledWith({ pageNum: 1, pageSize: 10 });
    expect(store.state.unreadCount).toBe(0);
  });

  it('does not repopulate the previous inbox after session cleanup', async () => {
    const store = useNoticeStore();
    let resolveList!: (value: unknown) => void;
    messageMocks.listMessages.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      })
    );
    messageMocks.getUnreadMessageCount.mockResolvedValue({ data: 3 });
    const pending = store.refresh();
    store.clearNotice();
    resolveList({ rows: [{ messageId: 101, title: 'previous user' }], total: 1 });
    await pending;
    expect(store.state).toEqual({ notices: [], unreadCount: 0, loading: false });
  });

  it('keeps the last requested page size for markRead, readAll, deleteByIds and bare refreshes', async () => {
    const store = useNoticeStore();
    messageMocks.listMessages.mockResolvedValue({ rows: [], total: 0 });
    messageMocks.getUnreadMessageCount.mockResolvedValue({ data: 0 });
    messageMocks.markMessageRead.mockResolvedValue(undefined);
    messageMocks.markAllMessagesRead.mockResolvedValue(undefined);
    messageMocks.deleteMessages.mockResolvedValue(undefined);

    await store.refresh(100);
    await store.markRead(1);
    await store.readAll();
    await store.deleteByIds([1]);
    await store.refresh();

    expect(messageMocks.listMessages).toHaveBeenCalledTimes(5);
    for (const call of messageMocks.listMessages.mock.calls) {
      expect(call[0]).toEqual({ pageNum: 1, pageSize: 100 });
    }
  });

  it('resets the remembered page size when the session is cleared', async () => {
    const store = useNoticeStore();
    messageMocks.listMessages.mockResolvedValue({ rows: [], total: 0 });
    messageMocks.getUnreadMessageCount.mockResolvedValue({ data: 0 });

    await store.refresh(100);
    store.clearNotice();
    await store.refresh();

    expect(messageMocks.listMessages).toHaveBeenLastCalledWith({ pageNum: 1, pageSize: 10 });
  });
});
