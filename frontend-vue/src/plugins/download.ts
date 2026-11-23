import axios from 'axios';
import FileSaver from 'file-saver';
import errorCode from '@/utils/errorCode';
import { blobValidate } from '@/utils/scaffold';
import type { LoadingInstance } from 'element-plus/es/components/loading/src/loading';
import { globalHeaders } from '@/utils/request';

const baseURL = import.meta.env.VITE_APP_BASE_API;
let downloadLoadingInstance: LoadingInstance | undefined;

interface DownloadErrorPayload {
  code?: string | number;
  msg?: string;
}

interface TextReadableBlob {
  text: () => Promise<string>;
}
export default {
  async oss(ossId: string | number) {
    const url = baseURL + '/resource/oss/download/' + ossId;
    downloadLoadingInstance = ElLoading.service({ text: '正在下载数据，请稍候', background: 'rgba(0, 0, 0, 0.7)' });
    try {
      const res = await axios({
        method: 'get',
        url: url,
        responseType: 'blob',
        headers: globalHeaders()
      });
      const isBlob = blobValidate(res.data);
      if (isBlob) {
        const fileName = res.headers['download-filename'] as string | undefined;
        if (!fileName) {
          // 缺少文件名时显式失败，避免把文件保存成 "undefined"。
          console.error('下载响应缺少 download-filename 响应头', url);
          ElMessage.error('下载失败：服务端未返回文件名');
          return;
        }
        const blob = new Blob([res.data], { type: 'application/octet-stream' });
        FileSaver.saveAs(blob, decodeURIComponent(fileName));
      } else {
        await this.printErrMsg(res.data);
      }
    } catch (r) {
      console.error(r);
      ElMessage.error('下载文件出现错误，请联系管理员！');
    } finally {
      downloadLoadingInstance?.close();
    }
  },
  async zip(url: string, name: string) {
    url = baseURL + url;
    downloadLoadingInstance = ElLoading.service({ text: '正在下载数据，请稍候', background: 'rgba(0, 0, 0, 0.7)' });
    try {
      const res = await axios({
        method: 'get',
        url: url,
        responseType: 'blob',
        headers: globalHeaders()
      });
      const isBlob = blobValidate(res.data);
      if (isBlob) {
        const blob = new Blob([res.data], { type: 'application/zip' });
        FileSaver.saveAs(blob, name);
      } else {
        await this.printErrMsg(res.data);
      }
    } catch (r) {
      console.error(r);
      ElMessage.error('下载文件出现错误，请联系管理员！');
    } finally {
      downloadLoadingInstance?.close();
    }
  },
  async printErrMsg(data: Blob | TextReadableBlob) {
    const resText = await data.text();
    const rspObj = JSON.parse(resText) as DownloadErrorPayload;
    const errMsg = errorCode[rspObj.code] || rspObj.msg || errorCode['default'];
    ElMessage.error(errMsg);
  }
};
