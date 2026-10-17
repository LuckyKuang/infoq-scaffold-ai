import request from '@/utils/request';
import type { TableResponse } from '@/api/types';
import type { InviteCodeCancelForm, InviteCodeGenerateForm, InviteCodeQuery, InviteCodeVO } from './types';

export function listInvite(query: InviteCodeQuery) {
  return request<TableResponse<InviteCodeVO>>({
    url: '/system/invite/list',
    method: 'get',
    params: query
  });
}

export function generateInvite(data: InviteCodeGenerateForm) {
  return request({
    url: '/system/invite/generate',
    method: 'post',
    data
  });
}

export function cancelInvite(data: InviteCodeCancelForm) {
  return request({
    url: '/system/invite/cancel',
    method: 'put',
    data
  });
}

export function delInvite(inviteIds: string | number | Array<string | number>) {
  return request({
    url: '/system/invite/' + inviteIds,
    method: 'delete'
  });
}
