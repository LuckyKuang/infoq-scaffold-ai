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
});
