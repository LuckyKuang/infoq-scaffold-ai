import { UserVO } from '@/api/system/user/types';
import { UserQuery } from '@/api/system/user/types';
import type { ApiResponse, TableResponse } from '@/api/types';
import { RoleForm, RoleQuery, RoleVO, RoleDeptTree } from './types';
import request from '@/utils/request';

type RolePayload = Record<string, unknown>;

export const listRole = (query: RoleQuery): Promise<TableResponse<RoleVO>> => {
  return request({
    url: '/system/role/list',
    method: 'get',
    params: query
  });
};

/**
 * 通过roleIds查询角色
 * @param roleIds
 */
export const optionSelect = (roleIds: (number | string)[]): Promise<ApiResponse<RoleVO[]>> => {
  return request({
    url: '/system/role/optionselect?roleIds=' + roleIds,
    method: 'get'
  });
};

/**
 * 查询角色详细
 */
export const getRole = (roleId: string | number): Promise<ApiResponse<RoleVO>> => {
  return request({
    url: '/system/role/' + roleId,
    method: 'get'
  });
};

/**
 * 新增角色
 */
export const addRole = (data: RoleForm) => {
  return request({
    url: '/system/role',
    method: 'post',
    data: data
  });
};

/**
 * 修改角色
 * @param data
 */
export const updateRole = (data: RoleForm) => {
  return request({
    url: '/system/role',
    method: 'put',
    data: data
  });
};

/**
 * 角色数据权限
 */
export const dataScope = (data: RolePayload) => {
  return request({
    url: '/system/role/dataScope',
    method: 'put',
    data: data
  });
};

/**
 * 角色状态修改
 */
export const changeRoleStatus = (roleId: string | number, status: string) => {
  const data = {
    roleId,
    status
  };
  return request({
    url: '/system/role/changeStatus',
    method: 'put',
    data: data
  });
};

/**
 * 删除角色
 */
export const delRole = (roleId: Array<string | number> | string | number) => {
  return request({
    url: '/system/role/' + roleId,
    method: 'delete'
  });
};

/**
 * 查询角色已授权用户列表
 */
export const allocatedUserList = (query: UserQuery): Promise<TableResponse<UserVO>> => {
  return request({
    url: '/system/role/authUser/allocatedList',
    method: 'get',
    params: query
  });
};

/**
 * 查询角色未授权用户列表
 */
export const unallocatedUserList = (query: UserQuery): Promise<TableResponse<UserVO>> => {
  return request({
    url: '/system/role/authUser/unallocatedList',
    method: 'get',
    params: query
  });
};

/**
 * 取消用户授权角色
 */
export const authUserCancel = (data: RolePayload) => {
  return request({
    url: '/system/role/authUser/cancel',
    method: 'put',
    data: data
  });
};

/**
 * 批量取消用户授权角色
 */
export const authUserCancelAll = (data: RolePayload) => {
  return request({
    url: '/system/role/authUser/cancelAll',
    method: 'put',
    params: data
  });
};

/**
 * 授权用户选择
 */
export const authUserSelectAll = (data: RolePayload) => {
  return request({
    url: '/system/role/authUser/selectAll',
    method: 'put',
    params: data
  });
};
// 根据角色ID查询部门树结构
export const deptTreeSelect = (roleId: string | number): Promise<ApiResponse<RoleDeptTree>> => {
  return request({
    url: '/system/role/deptTree/' + roleId,
    method: 'get'
  });
};

export default {
  optionSelect,
  listRole
};
