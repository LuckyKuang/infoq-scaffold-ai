export type MessageReadStatus = 'read' | 'unread';

export interface MessageQuery {
  pageNum?: number;
  pageSize?: number;
  messageType?: string;
  readStatus?: MessageReadStatus;
}

export interface MessageRecipientVO {
  messageId: number;
  messageType: string;
  messageLevel: string;
  title: string;
  content?: string;
  source: string;
  createTime: string;
  expireTime?: string;
  readTime?: string;
}
