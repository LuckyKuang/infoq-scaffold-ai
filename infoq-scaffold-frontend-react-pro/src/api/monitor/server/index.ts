import request from '@/utils/request';
import type { ApiResponse } from '@/api/types';
import type { ServerMonitorVO } from './types';

export function getServer() {
  return request<ApiResponse<ServerMonitorVO>>({
    url: '/monitor/server',
    method: 'get'
  });
}
