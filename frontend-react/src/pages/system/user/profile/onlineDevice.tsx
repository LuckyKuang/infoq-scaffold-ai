import { DeleteOutlined } from '@ant-design/icons';
import { Button, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import useDictOptions from '@/hooks/useDictOptions';
import { delOnline } from '@/api/monitor/online';
import type { OnlineVO } from '@/api/monitor/online/types';
import DictTag from '@/components/DictTag';
import { parseTime } from '@/utils/scaffold';
import modal from '@/utils/modal';

type OnlineDeviceProps = {
  devices: OnlineVO[];
  onChanged?: () => void;
};

export default function OnlineDevice({ devices, onChanged }: OnlineDeviceProps) {
  const dict = useDictOptions('sys_device_type');

  const columns: ColumnsType<OnlineVO> = [
    {
      title: '设备类型',
      dataIndex: 'deviceType',
      align: 'center',
      render: (value: string) => <DictTag options={dict.sys_device_type || []} value={value} />
    },
    {
      title: '主机',
      dataIndex: 'ipaddr',
      align: 'center',
      ellipsis: true
    },
    {
      title: '登录地点',
      dataIndex: 'loginLocation',
      align: 'center',
      ellipsis: true
    },
    {
      title: '操作系统',
      dataIndex: 'os',
      align: 'center',
      ellipsis: true
    },
    {
      title: '浏览器',
      dataIndex: 'browser',
      align: 'center',
      ellipsis: true
    },
    {
      title: '登录时间',
      dataIndex: 'loginTime',
      width: 180,
      align: 'center',
      render: (value: string | number) => parseTime(value) || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="删除">
          <Button
            danger
            type="link"
            icon={<DeleteOutlined />}
            onClick={async () => {
              const confirmed = await modal.confirm('删除设备后，在该设备登录需要重新进行验证');
              if (!confirmed) {
                return;
              }
              await delOnline(record.tokenId);
              modal.msgSuccess('删除成功');
              await onChanged?.();
            }}
          />
        </Tooltip>
      )
    }
  ];

  return <Table<OnlineVO> bordered rowKey="tokenId" dataSource={devices} columns={columns} pagination={false} />;
}
