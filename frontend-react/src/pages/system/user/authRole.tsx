import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, Row, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuthRole, updateAuthRole } from '@/api/system/user';
import type { UserVO } from '@/api/system/user/types';
import type { RoleVO } from '@/api/system/role/types';
import modal from '@/utils/modal';

export default function AuthRolePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = location.pathname.split('/').pop() || '';
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<Partial<UserVO>>({});
  const [roles, setRoles] = useState<RoleVO[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Array<string | number>>([]);

  const loadData = useCallback(async () => {
    if (!userId) {
      return;
    }
    setLoading(true);
    try {
      const response = await getAuthRole(userId);
      const { user, roles } = response.data;
      setUserInfo(user);
      setRoles(roles);
      setSelectedRoleIds(roles.filter((item) => item.flag).map((item) => item.roleId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = useMemo<ColumnsType<RoleVO>>(
    () => [
      {
        title: '序号',
        key: 'index',
        width: 70,
        align: 'center',
        render: (_value: unknown, _record: RoleVO, index: number) => index + 1
      },
      {
        title: '角色编号',
        dataIndex: 'roleId',
        width: 120,
        align: 'center'
      },
      {
        title: '角色名称',
        dataIndex: 'roleName',
        align: 'center'
      },
      {
        title: '权限字符',
        dataIndex: 'roleKey',
        align: 'center'
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value: string) => (value === '0' ? '正常' : '停用')
      },
      {
        title: '创建时间',
        dataIndex: 'createTime',
        width: 180,
        align: 'center'
      }
    ],
    []
  );

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Card title="基本信息">
        <Form layout="inline">
          <Row gutter={10} style={{ width: '100%' }}>
            <Col xs={24} md={8}>
              <Form.Item label="用户昵称" style={{ width: '100%', marginBottom: 0 }}>
                <Input value={userInfo.nickName} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="登录账号" style={{ width: '100%', marginBottom: 0 }}>
                <Input value={userInfo.userName} disabled />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="角色信息">
        <Table<RoleVO>
          rowKey="roleId"
          loading={loading}
          bordered
          columns={columns}
          dataSource={roles}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedRoleIds,
            getCheckboxProps: (record) => ({ disabled: record.status !== '0' }),
            onChange: (keys) => setSelectedRoleIds(keys as Array<string | number>)
          }}
        />
        <div style={{ textAlign: 'center', marginTop: 30 }}>
          <Space>
            <Button
              type="primary"
              onClick={async () => {
                await updateAuthRole({
                  userId,
                  roleIds: selectedRoleIds.join(',')
                });
                modal.msgSuccess('授权成功');
                navigate('/system/user');
              }}
            >
              提交
            </Button>
            <Button onClick={() => navigate('/system/user')}>返回</Button>
          </Space>
        </div>
      </Card>
    </Space>
  );
}
