import {request as umiRequest} from '@umijs/max';
import {getToken} from '@/utils/auth';

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

const pendingGetRequests = new Map<string, Promise<unknown>>();

const normalizeKeyPart = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeKeyPart);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const nextValue = (value as Record<string, unknown>)[key];
        if (nextValue !== undefined) {
          result[key] = normalizeKeyPart(nextValue);
        }
        return result;
      }, {});
  }
  return value;
};

const getRequestDedupeKey = <D,>({
  url,
  method = 'get',
  params,
  responseType,
}: LegacyRequestConfig<D>) => {
  if (method.toLowerCase() !== 'get') {
    return '';
  }
  return JSON.stringify({
    method: 'GET',
    url,
    params: normalizeKeyPart(params || {}),
    responseType: responseType || 'json',
    token: getToken() || '',
  });
};

export const globalHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  clientid: process.env.VITE_APP_CLIENT_ID || '',
});

const request = <T = unknown, D = unknown>(config: LegacyRequestConfig<D>) => {
  const { url, method = 'get', ...options } = config;
  const dedupeKey = getRequestDedupeKey(config);
  if (dedupeKey) {
    const pendingRequest = pendingGetRequests.get(dedupeKey);
    if (pendingRequest) {
      return pendingRequest as Promise<T>;
    }
  }

  const requestPromise = umiRequest(url, {
    method: method.toUpperCase(),
    ...options,
  } as any) as Promise<T>;

  if (dedupeKey) {
    pendingGetRequests.set(dedupeKey, requestPromise);
    requestPromise.then(
      () => pendingGetRequests.delete(dedupeKey),
      () => pendingGetRequests.delete(dedupeKey),
    );
  }

  return requestPromise;
};

export { request };
export default request;
