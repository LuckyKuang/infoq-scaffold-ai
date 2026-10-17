import request from '@/utils/request';
import type { ApiResponse, TableResponse } from '@/api/types';
import { NoticeForm, NoticeQuery, NoticeVO } from './types';
// 查询公告列表
export function listNotice(query: NoticeQuery) {
  return request<TableResponse<NoticeVO>>({
    url: '/system/notice/list',
    method: 'get',
    params: query
  });
}

// 查询公告详细
export function getNotice(noticeId: string | number) {
  return request<ApiResponse<NoticeVO>>({
    url: '/system/notice/' + noticeId,
    method: 'get'
  });
}

// 新增公告
export function addNotice(data: NoticeForm) {
  return request({
    url: '/system/notice',
    method: 'post',
    data: data
  });
}

// 修改公告
export function updateNotice(data: NoticeForm) {
  return request({
    url: '/system/notice',
    method: 'put',
    data: data
  });
}

// 删除公告
export function delNotice(noticeId: string | number | Array<string | number>) {
  return request({
    url: '/system/notice/' + noticeId,
    method: 'delete'
  });
}
