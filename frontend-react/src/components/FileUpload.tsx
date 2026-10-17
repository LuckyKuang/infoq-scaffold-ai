import { useEffect, useMemo, useState } from 'react';
import { Button, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { UploadOutlined } from '@ant-design/icons';
import { delOss, listByIds, uploadOss } from '@/api/system/oss';
import modal from '@/utils/modal';

type FileUploadValue = string | UploadFile[];

type FileUploadProps = {
  value?: FileUploadValue;
  limit?: number;
  fileSize?: number;
  fileType?: string[];
  showTip?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
};

type UploadFileWithOss = UploadFile & {
  ossId?: string | number;
};

const toValueString = (list: UploadFileWithOss[]) =>
  list
    .filter((item) => item.ossId)
    .map((item) => item.ossId)
    .join(',');

const asError = (error: unknown, fallback: string) => (error instanceof Error ? error : new Error(String(error || fallback)));

export default function FileUpload({
  value,
  limit = 5,
  fileSize = 5,
  fileType = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'pdf'],
  showTip = true,
  disabled = false,
  onChange
}: FileUploadProps) {
  const [fileList, setFileList] = useState<UploadFileWithOss[]>([]);

  const accept = useMemo(() => fileType.map((type) => `.${type}`).join(','), [fileType]);

  useEffect(() => {
    if (!value) {
      setFileList([]);
      return;
    }

    const hydrate = async () => {
      if (Array.isArray(value)) {
        setFileList(value);
        return;
      }
      try {
        const response = await listByIds(value);
        if (!Array.isArray(response.data)) {
          throw new Error('文件列表响应格式错误');
        }
        const next = response.data.map((item) => ({
          uid: String(item.ossId),
          name: item.originalName,
          status: 'done' as const,
          url: item.url,
          ossId: item.ossId
        }));
        setFileList(next);
      } catch {
        modal.msgError('加载已上传文件失败，请稍后重试');
      }
    };

    hydrate();
  }, [value]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    maxCount: limit,
    accept,
    fileList,
    disabled,
    customRequest({ file, filename, onProgress, onSuccess, onError }) {
      const controller = new AbortController();
      if (!(file instanceof Blob)) {
        const error = new Error('上传文件格式错误');
        modal.closeLoading();
        onError?.(error);
        return {
          abort: () => controller.abort()
        };
      }

      uploadOss(
        file,
        String(filename || 'file'),
        (event) => {
          if (event.total) {
            onProgress?.({ percent: (event.loaded / event.total) * 100 });
          }
        },
        controller.signal
      )
        .then((response) => {
          onSuccess?.(response);
        })
        .catch((error: unknown) => {
          onError?.(asError(error, '上传文件失败'));
        })
        .finally(() => {
          modal.closeLoading();
        });

      return {
        abort: () => controller.abort()
      };
    },
    beforeUpload(file) {
      const fileExt = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : '';
      if (!fileType.includes(fileExt)) {
        modal.msgError(`文件格式不正确，请上传 ${fileType.join('/')} 格式文件`);
        return Upload.LIST_IGNORE;
      }
      if (file.name.includes(',')) {
        modal.msgError('文件名不能包含英文逗号');
        return Upload.LIST_IGNORE;
      }
      const sizeOk = file.size / 1024 / 1024 < fileSize;
      if (!sizeOk) {
        modal.msgError(`上传文件大小不能超过 ${fileSize}MB`);
        return Upload.LIST_IGNORE;
      }
      modal.loading('正在上传文件，请稍候...');
      return true;
    },
    onChange(info) {
      let next = info.fileList as UploadFileWithOss[];

      if (info.file.status === 'done') {
        const resp = info.file.response as { code?: number; data?: { ossId?: string | number; fileName?: string; url?: string }; msg?: string };
        if (resp?.code === 200 && resp.data) {
          next = next.map((item) => {
            if (item.uid !== info.file.uid) {
              return item;
            }
            return {
              ...item,
              name: resp.data.fileName || item.name,
              url: resp.data.url || item.url,
              ossId: resp.data.ossId
            };
          });
          modal.closeLoading();
        } else {
          modal.closeLoading();
          modal.msgError(resp?.msg || '上传文件失败');
          next = next.filter((item) => item.uid !== info.file.uid);
        }
      }

      if (info.file.status === 'error') {
        modal.closeLoading();
        modal.msgError('上传文件失败');
      }

      setFileList(next);
      onChange?.(toValueString(next));
    },
    async onRemove(file) {
      const current = fileList.find((item) => item.uid === file.uid);
      if (current?.ossId) {
        await delOss(current.ossId);
      }
      const next = fileList.filter((item) => item.uid !== file.uid);
      setFileList(next);
      onChange?.(toValueString(next));
      return true;
    }
  };

  return (
    <div>
      <Upload {...uploadProps}>
        {!disabled && (
          <Button icon={<UploadOutlined />} type="primary">
            选取文件
          </Button>
        )}
      </Upload>
      {showTip && !disabled && (
        <div style={{ color: 'rgba(0, 0, 0, 0.45)', marginTop: 6 }}>
          请上传大小不超过 <b style={{ color: '#ff4d4f' }}>{fileSize}MB</b>，格式为 <b style={{ color: '#ff4d4f' }}>{fileType.join('/')}</b> 的文件
        </div>
      )}
    </div>
  );
}
