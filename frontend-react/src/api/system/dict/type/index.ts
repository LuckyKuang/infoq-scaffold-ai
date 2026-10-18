import request from '@/utils/request';
import type { ApiResponse, TableResponse } from '@/api/types';
import { DictTypeForm, DictTypeVO, DictTypeQuery } from './types';

// 查询字典类型列表
export function listType(query: DictTypeQuery) {
  return request<TableResponse<DictTypeVO>>({
    url: '/system/dict/type/list',
    method: 'get',
    params: query
  });
}

// 查询字典类型详细
export function getType(dictId: number | string) {
  return request<ApiResponse<DictTypeVO>>({
    url: '/system/dict/type/' + dictId,
    method: 'get'
  });
}

// 新增字典类型
export function addType(data: DictTypeForm) {
  return request({
    url: '/system/dict/type',
    method: 'post',
    data: data
  });
}

// 修改字典类型
export function updateType(data: DictTypeForm) {
  return request({
    url: '/system/dict/type',
    method: 'put',
    data: data
  });
}

// 删除字典类型
export function delType(dictId: string | number | Array<string | number>) {
  return request({
    url: '/system/dict/type/' + dictId,
    method: 'delete'
  });
}

// 刷新字典缓存
export function refreshCache() {
  return request({
    url: '/system/dict/type/refreshCache',
    method: 'delete'
  });
}

// 获取字典选择框列表
export function optionselect() {
  return request<ApiResponse<DictTypeVO[]>>({
    url: '/system/dict/type/optionselect',
    method: 'get'
  });
}
