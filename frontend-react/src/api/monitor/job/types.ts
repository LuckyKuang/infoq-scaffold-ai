export interface JobVO {
  jobId: string | number;
  jobName: string;
  jobGroup: string;
  handlerKey: string;
  handlerParams: string;
  cronExpression: string;
  misfirePolicy: string;
  concurrent: string;
  status: string;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export interface JobQuery extends PageQuery {
  jobName?: string;
  jobGroup?: string;
  handlerKey?: string;
  status?: string;
}

export interface JobForm {
  jobId?: string | number;
  jobName: string;
  jobGroup: string;
  handlerKey: string;
  handlerParams: string;
  cronExpression: string;
  misfirePolicy: string;
  concurrent: string;
  status: string;
  remark?: string;
}
