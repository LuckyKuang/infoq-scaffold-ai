import request from '@/utils/request';
import { NoticeForm, NoticeQuery, NoticeVO } from './types';
import type { ApiResponse, TableResponse } from '@/api/types';
// 查询公告列表
export function listNotice(query: NoticeQuery): Promise<TableResponse<NoticeVO>> {
  return request({
    url: '/system/notice/list',
    method: 'get',
    params: query
  });
}

// 查询公告详细
export function getNotice(noticeId: string | number): Promise<ApiResponse<NoticeVO>> {
  return request({
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
