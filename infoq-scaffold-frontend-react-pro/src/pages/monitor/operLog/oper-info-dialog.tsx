import { Card, Descriptions, Modal, Tag, Typography } from 'antd';
import type { OperLogVO } from '@/api/monitor/operLog/types';
import useDictOptions from '@/hooks/useDictOptions';

type OperInfoDialogProps = {
  open?: boolean;
  record?: OperLogVO | null;
  onClose?: () => void;
};

const formatJsonBlock = (value?: string) => {
  if (!value) {
    return '-';
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};

const contentNode = (record?: OperLogVO | null, businessTypeLabel?: string) => {
  if (!record) {
    return (
      <Typography.Paragraph type="secondary">
        请从操作日志列表中选择一条记录查看详情。
      </Typography.Paragraph>
    );
  }

  return (
    <Descriptions
      bordered
      column={1}
      size="small"
      styles={{
        label: { minWidth: 100 },
        content: {
          maxWidth: 300,
          whiteSpace: 'normal',
          wordBreak: 'break-all',
        },
      }}
    >
      <Descriptions.Item label="操作状态">
        {record.status === 0 ? (
          <Tag color="success">正常</Tag>
        ) : (
          <Tag color="error">失败</Tag>
        )}
      </Descriptions.Item>
      <Descriptions.Item label="登录信息">
        {[record.operName, record.deptName, record.operIp, record.operLocation]
          .filter(Boolean)
          .join(' / ') || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="请求信息">
        {[record.requestMethod, record.operUrl].filter(Boolean).join(' ') ||
          '-'}
      </Descriptions.Item>
      <Descriptions.Item label="操作模块">
        {[record.title, businessTypeLabel].filter(Boolean).join(' / ') || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="操作方法">
        {record.method || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="请求参数">
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {formatJsonBlock(record.operParam)}
          </pre>
        </div>
      </Descriptions.Item>
      <Descriptions.Item label="返回参数">
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {formatJsonBlock(record.jsonResult)}
          </pre>
        </div>
      </Descriptions.Item>
      <Descriptions.Item label="消耗时间">
        {record.costTime}ms
      </Descriptions.Item>
      <Descriptions.Item label="操作时间">
        {record.operTime || '-'}
      </Descriptions.Item>
      {record.status === 1 && (
        <Descriptions.Item label="异常信息">
          <span style={{ color: '#ff4d4f' }}>{record.errorMsg || '-'}</span>
        </Descriptions.Item>
      )}
    </Descriptions>
  );
};

export default function OperInfoDialog({
  open,
  record,
  onClose,
}: OperInfoDialogProps) {
  const dict = useDictOptions('sys_oper_type');
  const businessTypeLabel = (dict.sys_oper_type || []).find(
    (item) => item.value === String(record?.businessType),
  )?.label;

  if (typeof open === 'undefined') {
    return (
      <Card title="操作日志详细">{contentNode(record, businessTypeLabel)}</Card>
    );
  }

  return (
    <Modal
      width={700}
      footer={null}
      open={open}
      title="操作日志详细"
      onCancel={onClose}
    >
      {contentNode(record, businessTypeLabel)}
    </Modal>
  );
}
