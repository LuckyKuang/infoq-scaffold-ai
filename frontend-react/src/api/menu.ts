import request from '@/utils/request';
import type { ApiResponse } from '@/api/types';
import type { AppRoute } from '@/types/router';

// 获取路由
export function getRouters() {
  return request<ApiResponse<AppRoute[]>>({
    url: '/system/menu/getRouters',
    method: 'get'
  });
}
