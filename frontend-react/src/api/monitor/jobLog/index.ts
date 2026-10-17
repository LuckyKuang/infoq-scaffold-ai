import request from '@/utils/request';
import type { ApiResponse, TableResponse } from '@/api/types';
import type { JobLogQuery, JobLogVO } from './types';

export function listJobLog(query: JobLogQuery) {
  return request<TableResponse<JobLogVO>>({
    url: '/monitor/jobLog/list',
    method: 'get',
    params: query
  });
}

export function getJobLog(jobLogId: string | number) {
  return request<ApiResponse<JobLogVO>>({
    url: '/monitor/jobLog/' + jobLogId,
    method: 'get'
  });
}

export function delJobLog(jobLogId: string | number | Array<string | number>) {
  return request({
    url: '/monitor/jobLog/' + jobLogId,
    method: 'delete'
  });
}

export function cleanJobLog() {
  return request({
    url: '/monitor/jobLog/clean',
    method: 'delete'
  });
}
