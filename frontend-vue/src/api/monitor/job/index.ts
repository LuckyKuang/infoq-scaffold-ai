import request from '@/utils/request';
import type { ApiResponse, TableResponse } from '@/api/types';
import type { JobForm, JobQuery, JobVO } from './types';

export function listJob(query: JobQuery): Promise<TableResponse<JobVO>> {
  return request({
    url: '/monitor/job/list',
    method: 'get',
    params: query
  });
}

export function getJob(jobId: string | number): Promise<ApiResponse<JobVO>> {
  return request({
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

export function listJobHandlerKeys(): Promise<ApiResponse<string[]>> {
  return request({
    url: '/monitor/job/handlerKeys',
    method: 'get'
  });
}
