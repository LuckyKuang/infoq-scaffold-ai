import type { ApiResponse, TableResponse } from '@/api/types';
import request from '@/utils/request';
import type { OssQuery, OssVO } from './types';

// 查询OSS对象存储列表
export function listOss(query: OssQuery) {
  return request<TableResponse<OssVO>>({
    url: '/resource/oss/list',
    method: 'get',
    params: query,
  });
}

// 查询OSS对象基于id串
export function listByIds(ossId: string | number) {
  return request<ApiResponse<OssVO[]>>({
    url: `/resource/oss/listByIds/${ossId}`,
    method: 'get',
  });
}

// 删除OSS对象存储
export function delOss(ossId: string | number | Array<string | number>) {
  return request({
    url: `/resource/oss/${ossId}`,
    method: 'delete',
  });
}
