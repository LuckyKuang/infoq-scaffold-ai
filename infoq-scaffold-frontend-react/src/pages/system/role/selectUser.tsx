import { useEffect, useMemo, useState } from 'react';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Form, Input, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import useDictOptions from '@/hooks/useDictOptions';
import { authUserSelectAll, unallocatedUserList } from '@/api/system/role';
import type { UserQuery, UserVO } from '@/api/system/user/types';
import DictTag from '@/components/DictTag';
import Pagination from '@/components/Pagination';
import CrudModal from '@/components/CrudModal';
import modal from '@/utils/modal';

type SelectUserProps = {
  roleId?: string;
  open?: boolean;
  onClose?: () => void;
  onOk?: () => void;
};

const initialQuery: UserQuery = {
  pageNum: 1,
  pageSize: 10,
  roleId: '',
  userName: '',
  phonenumber: '',
  status: '',
  deptId: '',
  userIds: undefined
};

export default function SelectUser({ roleId, open, onClose, onOk }: SelectUserProps) {
  const [query, setQuery] = useState<UserQuery>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<UserVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const dict = useDictOptions('sys_normal_disable');

  const visible = open ?? true;

  const loadList = async (nextQuery: UserQuery) => {
    setLoading(true);
    try {
      const response = await unallocatedUserList(nextQuery);
      setList(response.rows);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible || !roleId) {
      return;
    }
    const next = {
      ...initialQuery,
      roleId
    };
    setQuery(next);
    setSelectedIds([]);
    loadList(next);
  }, [roleId, visible]);

  const columns = useMemo<ColumnsType<UserVO>>(
    () => [
      {
        title: '用户名称',
        dataIndex: 'userName'
      },
      {
        title: '用户昵称',
        dataIndex: 'nickName'
      },
      {
        title: '邮箱',
        dataIndex: 'email',
        ellipsis: true
      },
      {
        title: '手机',
        dataIndex: 'phonenumber'
      },
      {
        title: '状态',
        dataIndex: 'status',
        render: (value: string) => <DictTag options={dict.sys_normal_disable || []} value={value} />
      },
      {
        title: '创建时间',
        dataIndex: 'createTime',
        width: 180
      }
    ],
    [dict.sys_normal_disable]
  );

  const handleConfirm = async () => {
    if (!query.roleId || selectedIds.length === 0) {
      modal.msgError('请选择要分配的用户');
      return;
    }
    await authUserSelectAll({
      roleId: query.roleId,
      userIds: selectedIds.join(',')
    });
    modal.msgSuccess('分配成功');
    onOk?.();
    onClose?.();
  };

  if (typeof open === 'undefined') {
    return <CrudModal open title="选择用户" footer={null} onCancel={onClose} />;
  }

  return (
    <CrudModal width={800} open={visible} title="选择用户" onCancel={onClose} onOk={handleConfirm}>
      <Form layout="inline" className="query-form" style={{ marginBottom: 12 }}>
        <Form.Item label="用户名称">
          <Input
            allowClear
            value={query.userName}
            onChange={(event) => setQuery((prev) => ({ ...prev, userName: event.target.value }))}
            placeholder="请输入用户名称"
            onPressEnter={() => {
              const next = { ...query, pageNum: 1 };
              setQuery(next);
              loadList(next);
            }}
          />
        </Form.Item>
        <Form.Item label="手机号码">
          <Input
            allowClear
            value={query.phonenumber}
            onChange={(event) => setQuery((prev) => ({ ...prev, phonenumber: event.target.value }))}
            placeholder="请输入手机号码"
            onPressEnter={() => {
              const next = { ...query, pageNum: 1 };
              setQuery(next);
              loadList(next);
            }}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                const next = { ...query, pageNum: 1 };
                setQuery(next);
                loadList(next);
              }}
            >
              搜索
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                const next = { ...initialQuery, roleId: roleId || '' };
                setQuery(next);
                loadList(next);
              }}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<UserVO>
        rowKey="userId"
        loading={loading}
        bordered
        columns={columns}
        dataSource={list}
        scroll={{ y: 260 }}
        onRow={(record) => ({
          onClick: () => {
            setSelectedIds((current) =>
              current.includes(record.userId) ? current.filter((item) => item !== record.userId) : [...current, record.userId]
            );
          }
        })}
        pagination={false}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as Array<string | number>)
        }}
      />

      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onPageChange={({ page, limit }) => {
          const next = { ...query, pageNum: page, pageSize: limit };
          setQuery(next);
          loadList(next);
        }}
      />
    </CrudModal>
  );
}
