import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useUserStore } from '@/store/modules/user';
import { getToken } from '@/utils/auth';
import { blobValidate, tansParams } from '@/utils/scaffold';
import cache from '@/plugins/cache';
import { HttpStatus } from '@/enums/RespEnum';
import { errorCode } from '@/utils/errorCode';
import type { LoadingInstance } from 'element-plus/es/components/loading/src/loading';
import FileSaver from 'file-saver';
import { getLanguage } from '@/lang';
import { decryptBase64, decryptWithAes, encryptBase64, encryptWithAes, generateAesKey } from '@/utils/crypto';
import { decrypt, encrypt } from '@/utils/jsencrypt';
import router from '@/router';

const encryptHeader = 'encrypt-key';
let downloadLoadingInstance: LoadingInstance | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';

const requirePayloadRecord = (payload: unknown) => {
  if (!isRecord(payload)) {
    throw new Error('响应契约错误：响应体必须是对象');
  }
  return payload;
};

const readPayloadCode = (payload: unknown) => {
  const record = requirePayloadRecord(payload);
  if (!Object.prototype.hasOwnProperty.call(record, 'code')) {
    throw new Error('响应契约错误：缺少状态码 code');
  }
  const { code } = record;
  if (typeof code !== 'number' || !Number.isFinite(code)) {
    throw new Error('响应契约错误：状态码 code 必须是有限数字');
  }
  return code;
};

const validatePaginationPayload = (payload: unknown) => {
  const record = requirePayloadRecord(payload);
  const hasRows = Object.prototype.hasOwnProperty.call(record, 'rows');
  const hasTotal = Object.prototype.hasOwnProperty.call(record, 'total');
  if (!hasRows && !hasTotal) {
    return;
  }
  if (!Array.isArray(record.rows)) {
    throw new Error('响应契约错误：分页响应 rows 必须是数组');
  }
  if (typeof record.total !== 'number' || !Number.isFinite(record.total)) {
    throw new Error('响应契约错误：分页响应 total 必须是有限数字');
  }
};

type RequestConfig<D = unknown> = AxiosRequestConfig<D>;

interface SessionRequestPayload {
  url?: string;
  data?: unknown;
  time?: number;
}

interface ErrorResponsePayload {
  code?: string | number;
  msg?: string;
}

const getResponseErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return String(error ?? '');
};

interface RequestInstance extends Omit<AxiosInstance, 'request' | 'get' | 'delete' | 'head' | 'options' | 'post' | 'put' | 'patch'> {
  <T = unknown, D = unknown>(config: RequestConfig<D>): Promise<T>;
  request<T = unknown, D = unknown>(config: RequestConfig<D>): Promise<T>;
  get<T = unknown, D = unknown>(url: string, config?: RequestConfig<D>): Promise<T>;
  delete<T = unknown, D = unknown>(url: string, config?: RequestConfig<D>): Promise<T>;
  head<T = unknown, D = unknown>(url: string, config?: RequestConfig<D>): Promise<T>;
  options<T = unknown, D = unknown>(url: string, config?: RequestConfig<D>): Promise<T>;
  post<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig<D>): Promise<T>;
  put<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig<D>): Promise<T>;
  patch<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig<D>): Promise<T>;
}

// 是否显示重新登录
export const isRelogin = { show: false };
export const globalHeaders = () => {
  return {
    Authorization: 'Bearer ' + getToken(),
    clientid: import.meta.env.VITE_APP_CLIENT_ID
  };
};

axios.defaults.headers['Content-Type'] = 'application/json;charset=utf-8';
axios.defaults.headers['clientid'] = import.meta.env.VITE_APP_CLIENT_ID;
// 创建 axios 实例
const service = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 50000,
  transitional: {
    // 超时错误更明确
    clarifyTimeoutError: true
  }
});

// 请求拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 对应国际化资源文件后缀
    config.headers['Content-Language'] = getLanguage();

    const isToken = config.headers?.isToken === false;
    // 是否需要防止数据重复提交
    const isRepeatSubmit = config.headers?.repeatSubmit === false;
    // 是否需要加密
    const isEncrypt = config.headers?.isEncrypt === 'true';

    if (getToken() && !isToken) {
      config.headers['Authorization'] = 'Bearer ' + getToken(); // 让每个请求携带自定义token 请根据实际情况自行修改
    }
    // get请求映射params参数
    if (config.method === 'get' && config.params) {
      let url = config.url + '?' + tansParams(config.params as Record<string, unknown>);
      url = url.slice(0, -1);
      config.params = {};
      config.url = url;
    }

    if (!isRepeatSubmit && (config.method === 'post' || config.method === 'put')) {
      const requestObj = {
        url: config.url,
        data: typeof config.data === 'object' ? JSON.stringify(config.data) : config.data,
        time: new Date().getTime()
      };
      const sessionObj = cache.session.getJSON<SessionRequestPayload>('sessionObj');
      if (sessionObj === undefined || sessionObj === null) {
        cache.session.setJSON('sessionObj', requestObj);
      } else {
        const s_url = sessionObj.url; // 请求地址
        const s_data = sessionObj.data; // 请求数据
        const s_time = sessionObj.time; // 请求时间
        const interval = 500; // 间隔时间(ms)，小于此时间视为重复提交
        if (s_data === requestObj.data && requestObj.time - s_time < interval && s_url === requestObj.url) {
          const message = '数据正在处理，请勿重复提交';
          console.warn(`[${s_url}]: ` + message);
          return Promise.reject(new Error(message));
        } else {
          cache.session.setJSON('sessionObj', requestObj);
        }
      }
    }
    if (import.meta.env.VITE_APP_ENCRYPT === 'true') {
      // 当开启参数加密
      if (isEncrypt && (config.method === 'post' || config.method === 'put')) {
        // 生成一个 AES 密钥
        const aesKey = generateAesKey();
        config.headers[encryptHeader] = encrypt(encryptBase64(aesKey));
        const originData = typeof config.data === 'object' ? JSON.stringify(config.data) : (config.data as string);
        config.data = encryptWithAes(originData, aesKey);
      }
    }
    // FormData数据去请求头Content-Type
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
service.interceptors.response.use(
  (res: AxiosResponse) => {
    if (import.meta.env.VITE_APP_ENCRYPT === 'true') {
      // 加密后的 AES 秘钥
      const keyStr = res.headers[encryptHeader];
      // 加密
      if (keyStr != null && keyStr != '') {
        const data = res.data;
        // 请求体 AES 解密
        const base64Str = decrypt(keyStr);
        // base64 解码 得到请求头的 AES 秘钥
        const aesKey = decryptBase64(base64Str.toString());
        // aesKey 解码 data
        const decryptData = decryptWithAes(data, aesKey);
        // 将结果 (得到的是 JSON 字符串) 转为 JSON
        res.data = JSON.parse(decryptData);
      }
    }
    // 二进制数据则直接返回
    if (res.request.responseType === 'blob' || res.request.responseType === 'arraybuffer') {
      return res.data;
    }

    let code: number;
    try {
      code = readPayloadCode(res.data);
      validatePaginationPayload(res.data);
    } catch (error) {
      const message = getResponseErrorMessage(error) || '响应契约错误';
      ElMessage({ message, type: 'error' });
      return Promise.reject(error);
    }

    // 获取错误信息
    const msg = errorCode[code] || res.data.msg || errorCode['default'];
    if (code === 401) {
      // prettier-ignore
      if (!isRelogin.show) {
        isRelogin.show = true;
        ElMessageBox.confirm('登录状态已过期，您可以继续留在该页面，或者重新登录', '系统提示', {
          confirmButtonText: '重新登录',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(() => {
          isRelogin.show = false;
          useUserStore().logout().then(() => {
            router.replace({
              path: '/login',
              query: {
                redirect: encodeURIComponent(router.currentRoute.value.fullPath || '/')
              }
            })
          });
        }).catch(() => {
          isRelogin.show = false;
        });
      }
      return Promise.reject('无效的会话，或者会话已过期，请重新登录。');
    } else if (code === HttpStatus.SERVER_ERROR) {
      ElMessage({ message: msg, type: 'error' });
      return Promise.reject(new Error(msg));
    } else if (code === HttpStatus.WARN) {
      ElMessage({ message: msg, type: 'warning' });
      return Promise.reject(new Error(msg));
    } else if (code !== HttpStatus.SUCCESS) {
      ElNotification.error({ title: msg });
      return Promise.reject('error');
    } else {
      return res.data;
    }
  },
  (error: unknown) => {
    let message = getResponseErrorMessage(error);
    if (message == 'Network Error') {
      message = '后端接口连接异常';
    } else if (message.includes('timeout')) {
      message = '系统接口请求超时';
    } else if (message.includes('Request failed with status code')) {
      message = '系统接口' + message.substr(message.length - 3) + '异常';
    }
    ElMessage({ message: message, type: 'error', duration: 5 * 1000 });
    return Promise.reject(error);
  }
);

const request = service as RequestInstance;
// 通用下载方法
export function download(url: string, params: Record<string, unknown>, fileName: string) {
  downloadLoadingInstance = ElLoading.service({ text: '正在下载数据，请稍候', background: 'rgba(0, 0, 0, 0.7)' });
  // prettier-ignore
  return request.post<Blob, Record<string, unknown>>(url, params, {
      transformRequest: [
        (currentParams: unknown) => {
          return tansParams(currentParams as Record<string, unknown>);
        }
      ],
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      responseType: 'blob'
    }).then(async (resp: Blob) => {
      const isLogin = blobValidate(resp);
      if (isLogin) {
        const blob = new Blob([resp]);
        FileSaver.saveAs(blob, fileName);
      } else {
        const blob = new Blob([resp]);
        const resText = await blob.text();
        const rspObj = JSON.parse(resText) as ErrorResponsePayload;
        const errMsg = errorCode[rspObj.code] || rspObj.msg || errorCode['default'];
        ElMessage.error(errMsg);
      }
      downloadLoadingInstance?.close();
    }).catch((r: unknown) => {
      console.error(r);
      ElMessage.error('下载文件出现错误，请联系管理员！');
      downloadLoadingInstance?.close();
    });
}
// 导出 axios 实例
export default request;
