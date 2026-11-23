import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    vi.clearAllMocks();
    useNoticeStore.setState({ notices: [], unreadCount: 0, loading: false, pageSize: 10 });
  });

  it('refreshes the persisted inbox and unread count from the server', async () => {
    messageMocks.listMessages.mockResolvedValue({
      rows: [{ messageId: 101, title: 'Notice title', content: 'Notice body', read: false }],
      total: 1
    });
    messageMocks.getUnreadMessageCount.mockResolvedValue({ data: 3 });

    await useNoticeStore.getState().refresh(20);

    expect(messageMocks.listMessages).toHaveBeenCalledWith({ pageNum: 1, pageSize: 20 });
    expect(messageMocks.getUnreadMessageCount).toHaveBeenCalledTimes(1);
    expect(useNoticeStore.getState()).toMatchObject({
      unreadCount: 3,
      loading: false,
      notices: [{ messageId: 101, title: 'Notice title' }]
    });
  });

  it('marks a message as read and then refreshes the server truth', async () => {
    messageMocks.markMessageRead.mockResolvedValue(undefined);
    messageMocks.listMessages.mockResolvedValue({ rows: [], total: 0 });
    messageMocks.getUnreadMessageCount.mockResolvedValue({ data: 0 });

    await useNoticeStore.getState().markRead(101);

    expect(messageMocks.markMessageRead).toHaveBeenCalledWith(101);
    expect(messageMocks.listMessages).toHaveBeenCalledWith({ pageNum: 1, pageSize: 10 });
    expect(useNoticeStore.getState().unreadCount).toBe(0);
  });

  it('keeps the last requested page size for mutation and no-arg refreshes', async () => {
    messageMocks.markMessageRead.mockResolvedValue(undefined);
    messageMocks.markAllMessagesRead.mockResolvedValue(undefined);
    messageMocks.deleteMessages.mockResolvedValue(undefined);
    messageMocks.listMessages.mockResolvedValue({ rows: [], total: 0 });
    messageMocks.getUnreadMessageCount.mockResolvedValue({ data: 0 });

    await useNoticeStore.getState().refresh(100);
    await useNoticeStore.getState().markRead(101);
    await useNoticeStore.getState().markAllRead();
    await useNoticeStore.getState().deleteByIds([101, 102]);
    await useNoticeStore.getState().refresh();

    expect(messageMocks.listMessages).toHaveBeenCalledTimes(5);
    messageMocks.listMessages.mock.calls.forEach(([query]) => {
      expect(query).toEqual({ pageNum: 1, pageSize: 100 });
    });
  });

  it('resets the remembered page size when notices are cleared', async () => {
    messageMocks.listMessages.mockResolvedValue({ rows: [], total: 0 });
    messageMocks.getUnreadMessageCount.mockResolvedValue({ data: 0 });

    await useNoticeStore.getState().refresh(100);
    useNoticeStore.getState().clearNotices();
    await useNoticeStore.getState().refresh();

    expect(messageMocks.listMessages).toHaveBeenLastCalledWith({ pageNum: 1, pageSize: 10 });
  });
});
