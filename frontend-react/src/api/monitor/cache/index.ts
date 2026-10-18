import request from '@/utils/request';
import type { ApiResponse } from '@/api/types';
import { CacheVO } from './types';

// 查询缓存详细
export function getCache() {
  return request<ApiResponse<CacheVO>>({
    url: '/monitor/cache',
    method: 'get'
  });
}

// 查询缓存名称列表
export function listCacheName() {
  return request<ApiResponse<string[]>>({
    url: '/monitor/cache/getNames',
    method: 'get'
  });
}

// 查询缓存键名列表
export function listCacheKey(cacheName: string) {
  return request<ApiResponse<string[]>>({
    url: '/monitor/cache/getKeys/' + cacheName,
    method: 'get'
  });
}

// 查询缓存内容
export function getCacheValue(cacheName: string, cacheKey: string) {
  return request<ApiResponse<unknown>>({
    url: '/monitor/cache/getValue/' + cacheName + '/' + cacheKey,
    method: 'get'
  });
}

// 清理指定名称缓存
export function clearCacheName(cacheName: string) {
  return request({
    url: '/monitor/cache/clearCacheName/' + cacheName,
    method: 'delete'
  });
}

// 清理指定键名缓存
export function clearCacheKey(cacheName: string, cacheKey: string) {
  return request({
    url: '/monitor/cache/clearCacheKey/' + cacheName + '/' + cacheKey,
    method: 'delete'
  });
}

// 清理全部缓存
export function clearCacheAll() {
  return request({
    url: '/monitor/cache/clearCacheAll',
    method: 'delete'
  });
}
