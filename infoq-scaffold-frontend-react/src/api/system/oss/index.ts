import request from '@/utils/request';
import type { ApiResponse, TableResponse } from '@/api/types';
import { OssQuery, OssVO } from './types';
import type { AxiosProgressEvent } from 'axios';

// 查询OSS对象存储列表
export function listOss(query: OssQuery) {
  return request<TableResponse<OssVO>>({
    url: '/resource/oss/list',
    method: 'get',
    params: query
  });
}

// 查询OSS对象基于id串
export function listByIds(ossId: string | number) {
  return request<ApiResponse<OssVO[]>>({
    url: '/resource/oss/listByIds/' + ossId,
    method: 'get'
  });
}

export type OssUploadResult = {
  url: string;
  fileName: string;
  ossId: string | number;
};

export function uploadOss(file: Blob, filename = 'file', onUploadProgress?: (progressEvent: AxiosProgressEvent) => void, signal?: AbortSignal) {
  const data = new FormData();
  data.append(filename, file);
  return request<ApiResponse<OssUploadResult>>({
    url: '/resource/oss/upload',
    method: 'post',
    headers: {
      repeatSubmit: false
    },
    data,
    onUploadProgress,
    signal
  });
}

// 删除OSS对象存储
export function delOss(ossId: string | number | Array<string | number>) {
  return request({
    url: '/resource/oss/' + ossId,
    method: 'delete'
  });
}
