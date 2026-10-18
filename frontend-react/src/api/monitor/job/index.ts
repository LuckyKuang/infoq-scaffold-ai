import request from '@/utils/request';
import type { ApiResponse, TableResponse } from '@/api/types';
import type { JobForm, JobQuery, JobVO } from './types';

export function listJob(query: JobQuery) {
  return request<TableResponse<JobVO>>({
    url: '/monitor/job/list',
    method: 'get',
    params: query
  });
}

export function getJob(jobId: string | number) {
  return request<ApiResponse<JobVO>>({
    url: '/monitor/job/' + jobId,
    method: 'get'
  });
}

export function addJob(data: JobForm) {
  return request({
    url: '/monitor/job',
    method: 'post',
    data
  });
}

export function updateJob(data: JobForm) {
  return request({
    url: '/monitor/job',
    method: 'put',
    data
  });
}

export function delJob(jobId: string | number | Array<string | number>) {
  return request({
    url: '/monitor/job/' + jobId,
    method: 'delete'
  });
}

export function changeJobStatus(jobId: string | number, status: string) {
  return request({
    url: '/monitor/job/changeStatus',
    method: 'put',
    data: { jobId, status }
  });
}

export function runJob(jobId: string | number) {
  return request({
    url: '/monitor/job/run/' + jobId,
    method: 'put'
  });
}

export function listJobHandlerKeys() {
  return request<ApiResponse<string[]>>({
    url: '/monitor/job/handlerKeys',
    method: 'get'
  });
}
