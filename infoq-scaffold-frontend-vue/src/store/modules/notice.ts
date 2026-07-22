import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { deleteMessages, getUnreadMessageCount, listMessages, markAllMessagesRead, markMessageRead } from '@/api/system/message';
import type { MessageRecipientVO } from '@/api/system/message/types';

export type NoticeItem = MessageRecipientVO;

export const useNoticeStore = defineStore('notice', () => {
  const state = reactive({
    notices: [] as NoticeItem[],
    unreadCount: 0,
    loading: false
  });

  const refresh = async (pageSize = 10) => {
    state.loading = true;
    try {
      const [listResponse, unreadResponse] = await Promise.all([listMessages({ pageNum: 1, pageSize }), getUnreadMessageCount()]);
      state.notices = listResponse.rows;
      state.unreadCount = unreadResponse.data;
    } finally {
      state.loading = false;
    }
  };

  const markRead = async (messageId: number) => {
    await markMessageRead(messageId);
    await refresh();
  };

  const readAll = async () => {
    await markAllMessagesRead();
    await refresh();
  };

  const deleteByIds = async (messageIds: number[]) => {
    await deleteMessages(messageIds);
    await refresh();
  };

  const clearNotice = () => {
    state.notices = [];
    state.unreadCount = 0;
    state.loading = false;
  };
  return {
    state,
    refresh,
    markRead,
    readAll,
    deleteByIds,
    clearNotice
  };
});
