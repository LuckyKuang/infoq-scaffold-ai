import type { ApiResponse } from '@/api/types';
import type { AppRoute } from '@/types/router';
import request from '@/utils/request';

// 获取路由
export function getRouters() {
  return request<ApiResponse<AppRoute[]>>({
    url: '/system/menu/getRouters',
    method: 'get',
  });
}
