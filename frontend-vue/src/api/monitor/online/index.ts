import request from '@/utils/request';
import { OnlineQuery, OnlineVO } from './types';
import type { TableResponse } from '@/api/types';

// 查询在线用户列表
export function list(query: OnlineQuery): Promise<TableResponse<OnlineVO>> {
  return request({
    url: '/monitor/online/list',
    method: 'get',
    params: query
  });
}

// 强退用户
export function forceLogout(tokenId: string) {
  return request({
    url: '/monitor/online/' + tokenId,
    method: 'delete'
  });
}

// 获取当前用户登录在线设备
export function getOnline() {
  return request<TableResponse<OnlineVO>>({
    url: '/monitor/online',
    method: 'get'
  });
}

// 删除当前在线设备
export function delOnline(tokenId: string) {
  return request({
    url: '/monitor/online/myself/' + tokenId,
    method: 'delete'
  });
}
