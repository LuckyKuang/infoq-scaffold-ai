import request from '@/utils/request';
import type { ApiResponse } from '@/api/types';
import { RouteRecordRaw } from 'vue-router';

// 获取路由
export function getRouters(): Promise<ApiResponse<RouteRecordRaw[]>> {
  return request({
    url: '/system/menu/getRouters',
    method: 'get'
  });
}
