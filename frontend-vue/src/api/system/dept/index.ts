import request from '@/utils/request';
import type { ApiResponse } from '@/api/types';
import { DeptForm, DeptQuery, DeptVO } from './types';

// 查询部门列表
export const listDept = (query?: DeptQuery): Promise<ApiResponse<DeptVO[]>> => {
  return request({
    url: '/system/dept/list',
    method: 'get',
    params: query
  });
};

/**
 * 通过deptIds查询部门
 * @param deptIds
 */
export const optionSelect = (deptIds: (number | string)[]): Promise<ApiResponse<DeptVO[]>> => {
  return request({
    url: '/system/dept/optionselect?deptIds=' + deptIds,
    method: 'get'
  });
};

// 查询部门列表（排除节点）
export const listDeptExcludeChild = (deptId: string | number): Promise<ApiResponse<DeptVO[]>> => {
  return request({
    url: '/system/dept/list/exclude/' + deptId,
    method: 'get'
  });
};

// 查询部门详细
export const getDept = (deptId: string | number): Promise<ApiResponse<DeptVO>> => {
  return request({
    url: '/system/dept/' + deptId,
    method: 'get'
  });
};

// 新增部门
export const addDept = (data: DeptForm) => {
  return request({
    url: '/system/dept',
    method: 'post',
    data: data
  });
};

// 修改部门
export const updateDept = (data: DeptForm) => {
  return request({
    url: '/system/dept',
    method: 'put',
    data: data
  });
};

// 删除部门
export const delDept = (deptId: number | string) => {
  return request({
    url: '/system/dept/' + deptId,
    method: 'delete'
  });
};
