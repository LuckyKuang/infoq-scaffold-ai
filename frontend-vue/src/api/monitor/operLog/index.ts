import request from '@/utils/request';
import { OperLogQuery, OperLogVO } from './types';
import type { TableResponse } from '@/api/types';

// 查询操作日志列表
export function list(query: OperLogQuery): Promise<TableResponse<OperLogVO>> {
  return request({
    url: '/monitor/operLog/list',
    method: 'get',
    params: query
  });
}

// 删除操作日志
export function delOperLog(operId: string | number | Array<string | number>) {
  return request({
    url: '/monitor/operLog/' + operId,
    method: 'delete'
  });
}

// 清空操作日志
export function cleanOperLog() {
  return request({
    url: '/monitor/operLog/clean',
    method: 'delete'
  });
}
