import { request as umiRequest } from '@umijs/max';
import { getToken } from '@/utils/auth';

export { download } from '@/requestErrorConfig';

type LegacyRequestConfig<D = unknown> = {
  url: string;
  method?: string;
  params?: object;
  data?: D;
  headers?: Record<string, string | number | boolean>;
  timeout?: number;
  responseType?:
    | 'arraybuffer'
    | 'blob'
    | 'document'
    | 'json'
    | 'text'
    | 'stream';
  transformRequest?: Array<(data: any, headers?: any) => any>;
  [key: string]: unknown;
};

export const globalHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  clientid: process.env.VITE_APP_CLIENT_ID || '',
});

const request = <T = unknown, D = unknown>(config: LegacyRequestConfig<D>) => {
  const { url, method = 'get', ...options } = config;
  return umiRequest(url, {
    method: method.toUpperCase(),
    ...options,
  } as any) as Promise<T>;
};

export { request };
export default request;
