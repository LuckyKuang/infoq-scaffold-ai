import type { ApiResponse } from '@/api/types';
import request from '@/utils/request';
import type { DataSourceMonitorVO } from './types';

export function getDataSourceMonitor() {
  return request<ApiResponse<DataSourceMonitorVO>>({
    url: '/monitor/dataSource',
    method: 'get',
  });
}
