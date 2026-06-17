export interface JobLogVO {
  jobLogId: string | number;
  jobId: string | number;
  jobName: string;
  jobGroup: string;
  handlerKey: string;
  handlerParams: string;
  triggerSource: string;
  jobMessage: string;
  status: string;
  exceptionInfo?: string;
  durationMs?: number;
  startTime?: string;
  endTime?: string;
}

export interface JobLogQuery extends PageQuery {
  jobId?: string | number;
  jobName?: string;
  jobGroup?: string;
  handlerKey?: string;
  triggerSource?: string;
  status?: string;
}
