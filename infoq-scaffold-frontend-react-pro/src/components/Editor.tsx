import { PictureOutlined } from '@ant-design/icons';
import { Button, Input, Space, Upload } from 'antd';
import type { UploadProps } from 'antd/es/upload';
import { useMemo } from 'react';
import modal from '@/utils/modal';
import { globalHeaders } from '@/utils/request';

type EditorProps = {
  value?: string;
  height?: number;
  minHeight?: number;
  readOnly?: boolean;
  fileSize?: number;
  onChange?: (value: string) => void;
};

export default function Editor({
  value,
  height = 400,
  minHeight = 400,
  readOnly = false,
  fileSize = 5,
  onChange,
}: EditorProps) {
  const style = useMemo(
    () => ({
      height,
      minHeight,
    }),
    [height, minHeight],
  );

  const uploadProps: UploadProps = {
    name: 'file',
    action: `${import.meta.env.VITE_APP_BASE_API}/resource/oss/upload`,
    headers: globalHeaders(),
    showUploadList: false,
    beforeUpload(file) {
      const okType = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/svg+xml',
      ].includes(file.type);
      if (!okType) {
        modal.msgError('图片格式错误');
        return Upload.LIST_IGNORE;
      }
      const sizeOk = file.size / 1024 / 1024 < fileSize;
      if (!sizeOk) {
        modal.msgError(`上传文件大小不能超过 ${fileSize}MB`);
        return Upload.LIST_IGNORE;
      }
      modal.loading('正在上传图片，请稍候...');
      return true;
    },
    onChange(info) {
      if (info.file.status === 'done') {
        const resp = info.file.response as {
          code?: number;
          data?: { url?: string };
          msg?: string;
        };
        if (resp?.code === 200 && resp.data?.url) {
          const next = `${value || ''}<p><img src="${resp.data.url}" alt="image" /></p>`;
          onChange?.(next);
          modal.closeLoading();
        } else {
          modal.closeLoading();
          modal.msgError(resp?.msg || '图片插入失败');
        }
      }
      if (info.file.status === 'error') {
        modal.closeLoading();
        modal.msgError('上传文件失败');
      }
    },
  };

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {!readOnly && (
        <Upload {...uploadProps}>
          <Button icon={<PictureOutlined />}>上传图片</Button>
        </Upload>
      )}
      <Input.TextArea
        value={value}
        readOnly={readOnly}
        style={style}
        onChange={(evt) => {
          onChange?.(evt.target.value);
        }}
      />
    </Space>
  );
}
