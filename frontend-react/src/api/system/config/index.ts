import request from '@/utils/request';
import type { ApiResponse, TableResponse } from '@/api/types';
import { ConfigForm, ConfigPanel, ConfigQuery, ConfigReorderForm, ConfigVO } from './types';

// 查询参数列表
export function listConfig(query: ConfigQuery) {
  return request<TableResponse<ConfigVO>>({
    url: '/system/config/list',
    method: 'get',
    params: query
  });
}

// 查询参数配置面板
export function getConfigPanel() {
  return request<ApiResponse<ConfigPanel>>({
    url: '/system/config/panel',
    method: 'get'
  });
}

// 查询参数详细
export function getConfig(configId: string | number) {
  return request<ApiResponse<ConfigVO>>({
    url: '/system/config/' + configId,
    method: 'get'
  });
}

// 根据参数键名查询参数值
export function getConfigKey(configKey: string) {
  return request<ApiResponse<string>>({
    url: '/system/config/configKey/' + configKey,
    method: 'get'
  });
}

// 新增参数配置
export function addConfig(data: ConfigForm) {
  return request({
    url: '/system/config',
    method: 'post',
    data: data
  });
}

// 修改参数配置
export function updateConfig(data: ConfigForm) {
  return request({
    url: '/system/config',
    method: 'put',
    data: data
  });
}

// 修改参数配置
export function updateConfigByKey(key: string, value: string | number | boolean | null) {
  return request({
    url: '/system/config/updateByKey',
    method: 'put',
    data: {
      configKey: key,
      configValue: value
    }
  });
}

// 根据参数键名恢复默认值
export function resetConfigByKey(key: string) {
  return request<ApiResponse<string>>({
    url: '/system/config/resetByKey',
    method: 'post',
    data: {
      configKey: key
    }
  });
}

// 批量调整参数显示顺序
export function reorderConfig(data: ConfigReorderForm[]) {
  return request({
    url: '/system/config/reorder',
    method: 'put',
    data
  });
}

// 删除参数配置
export function delConfig(configId: string | number | Array<string | number>) {
  return request({
    url: '/system/config/' + configId,
    method: 'delete'
  });
}

// 刷新参数缓存
export function refreshCache() {
  return request({
    url: '/system/config/refreshCache',
    method: 'delete'
  });
}
