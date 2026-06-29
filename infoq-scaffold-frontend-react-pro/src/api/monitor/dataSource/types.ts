export interface DataSourceMonitorSummary {
  dataSourceCount: number;
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maximumPoolSize: number;
  threadsAwaitingConnection: number;
}

export interface DataSourcePoolVO {
  name: string;
  dbType: string;
  metricsReady: boolean;
  running: boolean;
  activeConnections: number | null;
  idleConnections: number | null;
  totalConnections: number | null;
  threadsAwaitingConnection: number | null;
  maximumPoolSize: number | null;
  usagePercent: number | null;
  state: string;
}

export interface DataSourceMonitorVO {
  summary: DataSourceMonitorSummary;
  items: DataSourcePoolVO[];
}
