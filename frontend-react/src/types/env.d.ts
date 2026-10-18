interface ImportMetaEnv {
  VITE_APP_TITLE: string;
  VITE_APP_PORT: number;
  VITE_APP_BASE_API: string;
  VITE_APP_CONTEXT_PATH: string;
  VITE_APP_ENV: string;
  VITE_APP_ENCRYPT: string;
  VITE_APP_RSA_PUBLIC_KEY: string;
  VITE_APP_RSA_PRIVATE_KEY: string;
  VITE_APP_CLIENT_ID: string;
  VITE_APP_WEBSOCKET: string;
  VITE_APP_SSE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare type ElTagType = 'primary' | 'success' | 'info' | 'warning' | 'danger';

declare interface DictDataOption {
  label: string;
  value: string;
  elTagType?: ElTagType;
  elTagClass?: string;
}

declare interface PageQuery {
  pageNum: number;
  pageSize: number;
}

declare interface BaseEntity {
  createBy?: unknown;
  createDept?: unknown;
  createTime?: string;
  updateBy?: unknown;
  updateTime?: unknown;
}
