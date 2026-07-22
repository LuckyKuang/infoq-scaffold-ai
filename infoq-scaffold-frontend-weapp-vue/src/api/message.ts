import {request} from '@/api/request';
import type {ApiResponse, MessageRecipientVO, TableResponse} from '@/api/types';

export const listMessages = (pageNum = 1, pageSize = 20) => request<TableResponse<MessageRecipientVO>>({ url: '/system/message/list', method: 'GET', params: { pageNum, pageSize } });
export const getUnreadMessageCount = () => request<ApiResponse<number>>({ url: '/system/message/unread-count', method: 'GET' });
export const markMessageRead = (messageId: number) => request({ url: `/system/message/${messageId}/read`, method: 'POST' });
export const markAllMessagesRead = () => request({ url: '/system/message/read-all', method: 'POST' });
export const deleteMessages = (messageIds: number[]) => request({ url: `/system/message/${messageIds.join(',')}`, method: 'DELETE' });
