import request from '@/utils/request';
import type { ApiResponse, TableResponse } from '@/api/types';
import type { MessageQuery, MessageRecipientVO } from './types';

export const listMessages = (query: MessageQuery) =>
  request<TableResponse<MessageRecipientVO>>({
    url: '/system/message/list',
    method: 'get',
    params: query
  });

export const getUnreadMessageCount = () =>
  request<ApiResponse<number>>({
    url: '/system/message/unread-count',
    method: 'get'
  });

export const markMessageRead = (messageId: number) =>
  request({
    url: `/system/message/${messageId}/read`,
    method: 'post'
  });

export const markAllMessagesRead = () =>
  request({
    url: '/system/message/read-all',
    method: 'post'
  });

export const deleteMessages = (messageIds: number[]) =>
  request({
    url: `/system/message/${messageIds.join(',')}`,
    method: 'delete'
  });
