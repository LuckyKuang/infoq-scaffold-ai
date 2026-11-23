import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { deleteMessages, getUnreadMessageCount, listMessages, markAllMessagesRead, markMessageRead } from '@/api/system/message';
import type { MessageRecipientVO } from '@/api/system/message/types';

export type NoticeItem = MessageRecipientVO;

const DEFAULT_PAGE_SIZE = 10;

export const useNoticeStore = defineStore('notice', () => {
  let sessionGeneration = 0;
  // 记住最近一次显式请求的页大小，避免消息中心的 100 条列表被 markRead/SSE 等无参刷新缩回 10 条。
  let lastPageSize = DEFAULT_PAGE_SIZE;
  const state = reactive({
    notices: [] as NoticeItem[],
    unreadCount: 0,
    loading: false
  });

  const refresh = async (pageSize?: number) => {
    if (pageSize !== undefined) lastPageSize = pageSize;
    const requestedPageSize = lastPageSize;
    const generation = sessionGeneration;
    state.loading = true;
    try {
      const [listResponse, unreadResponse] = await Promise.all([listMessages({ pageNum: 1, pageSize: requestedPageSize }), getUnreadMessageCount()]);
      if (generation !== sessionGeneration) return;
      state.notices = listResponse.rows;
      state.unreadCount = unreadResponse.data;
    } finally {
      if (generation === sessionGeneration) state.loading = false;
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
    sessionGeneration++;
    lastPageSize = DEFAULT_PAGE_SIZE;
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
