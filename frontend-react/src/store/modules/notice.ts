import { create } from 'zustand';
import { deleteMessages, getUnreadMessageCount, listMessages, markAllMessagesRead, markMessageRead } from '@/api/system/message';
import type { MessageRecipientVO } from '@/api/system/message/types';

export type NoticeItem = MessageRecipientVO;

type NoticeState = {
  notices: NoticeItem[];
  unreadCount: number;
  loading: boolean;
  // 最近一次显式请求的页大小；markRead/markAllRead/deleteByIds 与实时推送刷新沿用它，避免列表被缩回默认大小
  pageSize: number;
  refresh: (pageSize?: number) => Promise<void>;
  markRead: (messageId: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteByIds: (messageIds: number[]) => Promise<void>;
  clearNotices: () => void;
};

const DEFAULT_PAGE_SIZE = 10;

export const useNoticeStore = create<NoticeState>((set, get) => ({
  notices: [],
  unreadCount: 0,
  loading: false,
  pageSize: DEFAULT_PAGE_SIZE,
  refresh: async (requestedPageSize) => {
    const pageSize = requestedPageSize ?? get().pageSize;
    set({ loading: true, pageSize });
    try {
      const [listResponse, unreadResponse] = await Promise.all([listMessages({ pageNum: 1, pageSize }), getUnreadMessageCount()]);
      set({ notices: listResponse.rows, unreadCount: unreadResponse.data });
    } finally {
      set({ loading: false });
    }
  },
  markRead: async (messageId) => {
    await markMessageRead(messageId);
    await get().refresh();
  },
  markAllRead: async () => {
    await markAllMessagesRead();
    await get().refresh();
  },
  deleteByIds: async (messageIds) => {
    await deleteMessages(messageIds);
    await get().refresh();
  },
  clearNotices: () => set({ notices: [], unreadCount: 0, loading: false, pageSize: DEFAULT_PAGE_SIZE })
}));
