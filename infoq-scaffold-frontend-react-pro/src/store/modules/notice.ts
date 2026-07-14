import {create} from 'zustand';
import {
  deleteMessages,
  getUnreadMessageCount,
  listMessages,
  markAllMessagesRead,
  markMessageRead
} from '@/api/system/message';
import type {MessageRecipientVO} from '@/api/system/message/types';

export type NoticeItem = MessageRecipientVO;

type NoticeState = {
  notices: NoticeItem[];
  unreadCount: number;
  loading: boolean;
  refresh: (pageSize?: number) => Promise<void>;
  markRead: (messageId: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteByIds: (messageIds: number[]) => Promise<void>;
  clearNotices: () => void;
};

export const useNoticeStore = create<NoticeState>((set) => ({
  notices: [],
  unreadCount: 0,
  loading: false,
  refresh: async (pageSize = 10) => {
    set({ loading: true });
    try {
      const [listResponse, unreadResponse] = await Promise.all([
        listMessages({ pageNum: 1, pageSize }),
        getUnreadMessageCount(),
      ]);
      set({ notices: listResponse.rows, unreadCount: unreadResponse.data });
    } finally {
      set({ loading: false });
    }
  },
  markRead: async (messageId) => {
    await markMessageRead(messageId);
    await useNoticeStore.getState().refresh();
  },
  markAllRead: async () => {
    await markAllMessagesRead();
    await useNoticeStore.getState().refresh();
  },
  deleteByIds: async (messageIds) => {
    await deleteMessages(messageIds);
    await useNoticeStore.getState().refresh();
  },
  clearNotices: () => set({ notices: [], unreadCount: 0, loading: false }),
}));
