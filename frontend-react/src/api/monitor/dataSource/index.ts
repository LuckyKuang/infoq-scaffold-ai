import request from '@/utils/request';
import type { ApiResponse } from '@/api/types';
import type { DataSourceMonitorVO } from './types';

export function getDataSourceMonitor() {
  return request<ApiResponse<DataSourceMonitorVO>>({
    url: '/monitor/dataSource',
    method: 'get'
  });
}
