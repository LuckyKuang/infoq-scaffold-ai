import request from '@/utils/request';
import { OssQuery, OssVO } from './types';
import type { ApiResponse, TableResponse } from '@/api/types';

// 查询OSS对象存储列表
export function listOss(query: OssQuery): Promise<TableResponse<OssVO>> {
  return request({
    url: '/resource/oss/list',
    method: 'get',
    params: query
  });
}

// 查询OSS对象基于id串
export function listByIds(ossId: string | number): Promise<ApiResponse<OssVO[]>> {
  return request({
    url: '/resource/oss/listByIds/' + ossId,
    method: 'get'
  });
}

export type OssUploadResult = {
  url: string;
  fileName: string;
  ossId: string | number;
};

export function uploadOss(file: Blob, filename = 'file'): Promise<ApiResponse<OssUploadResult>> {
  const data = new FormData();
  data.append(filename, file);
  return request({
    url: '/resource/oss/upload',
    method: 'post',
    headers: {
      repeatSubmit: false
    },
    data
  });
}

// 删除OSS对象存储
export function delOss(ossId: string | number | Array<string | number>) {
  return request({
    url: '/resource/oss/' + ossId,
    method: 'delete'
  });
}
