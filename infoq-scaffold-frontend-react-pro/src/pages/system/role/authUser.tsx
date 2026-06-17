import {
  CloseOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Space,
  Table,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  allocatedUserList,
  authUserCancel,
  authUserCancelAll,
} from '@/api/system/role';
import type { UserQuery, UserVO } from '@/api/system/user/types';
import DictTag from '@/components/DictTag';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import useDictOptions from '@/hooks/useDictOptions';
import SelectUser from '@/pages/system/role/selectUser';
import modal from '@/utils/modal';

const baseQuery: UserQuery = {
  pageNum: 1,
  pageSize: 10,
  roleId: '',
  userName: '',
  phonenumber: '',
  status: '',
  deptId: '',
  userIds: undefined,
};

export default function AuthUserPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const roleId = location.pathname.split('/').pop() || '';
  const [query, setQuery] = useState<UserQuery>({ ...baseQuery, roleId });
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<UserVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [selectOpen, setSelectOpen] = useState(false);
  const dict = useDictOptions('sys_normal_disable');

  const loadList = useCallback(async (nextQuery: UserQuery) => {
    setLoading(true);
    try {
      const response = await allocatedUserList(nextQuery);
      setList(response.rows);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const next = { ...baseQuery, roleId };
    setQuery(next);
    loadList(next);
  }, [loadList, roleId]);

  const columns: ColumnsType<UserVO> = [
    {
      title: '用户名称',
      dataIndex: 'userName',
      ellipsis: true,
    },
    {
      title: '用户昵称',
      dataIndex: 'nickName',
      ellipsis: true,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      ellipsis: true,
    },
    {
      title: '手机',
      dataIndex: 'phonenumber',
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      render: (value: string) => (
        <DictTag options={dict.sys_normal_disable || []} value={value} />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
      align: 'center',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="取消授权">
          <Button
            danger
            type="link"
            icon={<StopOutlined />}
            onClick={async () => {
              const confirmed = await modal.confirm(
                `确认要取消该用户 "${record.userName}" 角色吗？`,
              );
              if (!confirmed) {
                return;
              }
              await authUserCancel({ userId: record.userId, roleId });
              modal.msgSuccess('取消授权成功');
              loadList(query);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {showSearch && (
        <Card>
          <Form layout="inline" className="query-form">
            <Row gutter={16} style={{ width: '100%' }}>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="用户名称"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入用户名称"
                    value={query.userName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        userName: event.target.value,
                      }))
                    }
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="手机号码"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入手机号码"
                    value={query.phonenumber}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        phonenumber: event.target.value,
                      }))
                    }
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item style={{ marginBottom: 0 }}>
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
                        const next = { ...baseQuery, roleId };
                        setQuery(next);
                        loadList(next);
                      }}
                    >
                      重置
                    </Button>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      )}

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <Space wrap>
            <Button
              className="btn-plain-primary"
              icon={<PlusOutlined />}
              onClick={() => setSelectOpen(true)}
            >
              添加用户
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              style={{ borderColor: '#ffccc7' }}
              disabled={selectedIds.length === 0}
              onClick={async () => {
                const confirmed = await modal.confirm(
                  '是否取消选中用户授权数据项？',
                );
                if (!confirmed) {
                  return;
                }
                await authUserCancelAll({
                  roleId,
                  userIds: selectedIds.join(','),
                });
                modal.msgSuccess('取消授权成功');
                setSelectedIds([]);
                loadList(query);
              }}
            >
              批量取消授权
            </Button>
            <Button
              icon={<CloseOutlined />}
              style={{ color: '#e6a23c', borderColor: '#ffd591' }}
              onClick={() => navigate('/system/role')}
            >
              关闭
            </Button>
          </Space>
          <RightToolbar
            showSearch={showSearch}
            onShowSearchChange={setShowSearch}
            onQueryTable={() => loadList(query)}
          />
        </div>

        <Table<UserVO>
          rowKey="userId"
          loading={loading}
          bordered
          columns={columns}
          dataSource={list}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as Array<string | number>),
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
      </Card>

      <SelectUser
        open={selectOpen}
        roleId={roleId}
        onClose={() => setSelectOpen(false)}
        onOk={() => {
          setSelectOpen(false);
          loadList(query);
        }}
      />
    </Space>
  );
}
