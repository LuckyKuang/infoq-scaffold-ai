import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tooltip,
  Tree,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  treeselect as menuTreeselect,
  roleMenuTreeselect,
} from '@/api/system/menu';
import type { MenuTreeOption } from '@/api/system/menu/types';
import {
  addRole,
  changeRoleStatus,
  dataScope,
  delRole,
  deptTreeSelect,
  getRole,
  listRole,
  updateRole,
} from '@/api/system/role';
import type {
  RoleDeptTree,
  RoleForm,
  RoleQuery,
  RoleVO,
} from '@/api/system/role/types';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import useDictOptions from '@/hooks/useDictOptions';
import modal from '@/utils/modal';
import { download } from '@/utils/request';
import { addDateRange } from '@/utils/scaffold';

type TreeOption = MenuTreeOption;
type RoleTreeOption = TreeOption | RoleDeptTree['depts'][number];

const initialQuery: RoleQuery = {
  pageNum: 1,
  pageSize: 10,
  roleName: '',
  roleKey: '',
  status: '',
};

const initialForm: RoleForm = {
  roleId: undefined,
  roleName: '',
  roleKey: '',
  roleSort: 1,
  status: '0',
  menuCheckStrictly: true,
  deptCheckStrictly: true,
  remark: '',
  dataScope: '1',
  menuIds: [],
  deptIds: [],
};

const dataScopeOptions = [
  { value: '1', label: '全部数据权限' },
  { value: '2', label: '自定数据权限' },
  { value: '3', label: '本部门数据权限' },
  { value: '4', label: '本部门及以下数据权限' },
  { value: '5', label: '仅本人数据权限' },
  { value: '6', label: '部门及以下或本人数据权限' },
];

const formatRange = (range: [Dayjs, Dayjs] | null) =>
  range
    ? [
        range[0].format('YYYY-MM-DD HH:mm:ss'),
        range[1].format('YYYY-MM-DD HH:mm:ss'),
      ]
    : [];

const toTreeData = (nodes: RoleTreeOption[]): DataNode[] =>
  nodes.map((node) => ({
    key: String(node.id),
    title: node.label,
    children: node.children?.length ? toTreeData(node.children) : undefined,
  }));

export default function RolePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState<RoleQuery>(initialQuery);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<RoleVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [menuOptions, setMenuOptions] = useState<MenuTreeOption[]>([]);
  const [deptOptions, setDeptOptions] = useState<RoleDeptTree['depts']>([]);
  const [checkedMenuKeys, setCheckedMenuKeys] = useState<
    Array<string | number>
  >([]);
  const [checkedDeptKeys, setCheckedDeptKeys] = useState<
    Array<string | number>
  >([]);
  const [form] = Form.useForm<RoleForm>();
  const editingRoleId = Form.useWatch('roleId', form);
  const menuCheckStrictly =
    Form.useWatch('menuCheckStrictly', form) ?? initialForm.menuCheckStrictly;
  const deptCheckStrictly =
    Form.useWatch('deptCheckStrictly', form) ?? initialForm.deptCheckStrictly;
  const currentDataScope =
    Form.useWatch('dataScope', form) ?? initialForm.dataScope;
  const dict = useDictOptions('sys_normal_disable');

  const loadList = useCallback(
    async (
      nextQuery: RoleQuery = query,
      nextRange: [Dayjs, Dayjs] | null = dateRange,
    ) => {
      setLoading(true);
      try {
        const response = await listRole(
          addDateRange({ ...nextQuery }, formatRange(nextRange)),
        );
        setList(response.rows);
        setTotal(response.total);
      } finally {
        setLoading(false);
      }
    },
    [dateRange, query],
  );

  const loadMenuTree = async (roleId?: string | number) => {
    if (roleId) {
      const response = await roleMenuTreeselect(roleId);
      const data = response.data;
      setMenuOptions(data.menus);
      setCheckedMenuKeys(data.checkedKeys.map(String));
      return;
    }
    const response = await menuTreeselect();
    setMenuOptions(response.data);
    setCheckedMenuKeys([]);
  };

  const loadDeptTree = async (roleId: string | number) => {
    const response = await deptTreeSelect(roleId);
    setDeptOptions(response.data.depts);
    setCheckedDeptKeys(response.data.checkedKeys.map(String));
  };

  useEffect(() => {
    loadList(initialQuery, null);
  }, [loadList]);

  const columns: ColumnsType<RoleVO> = [
    {
      title: '角色名称',
      dataIndex: 'roleName',
      width: 150,
      align: 'center',
      ellipsis: true,
    },
    {
      title: '权限字符',
      dataIndex: 'roleKey',
      width: 200,
      align: 'center',
      ellipsis: true,
    },
    { title: '显示顺序', dataIndex: 'roleSort', width: 100, align: 'center' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      align: 'center',
      render: (value: string, record) => (
        <Switch
          checked={value === '0'}
          onChange={async (checked) => {
            const nextStatus = checked ? '0' : '1';
            const confirmed = await modal.confirm(
              `确认要${nextStatus === '0' ? '启用' : '停用'} "${record.roleName}" 角色吗？`,
            );
            if (!confirmed) {
              return;
            }
            await changeRoleStatus(record.roleId, nextStatus);
            modal.msgSuccess('状态修改成功');
            loadList();
          }}
        />
      ),
    },
    { title: '创建时间', dataIndex: 'createTime', width: 180, align: 'center' },
    {
      title: '操作',
      key: 'action',
      width: 180,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.roleId !== 1 && (
            <>
              <Tooltip title="修改">
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record.roleId)}
                />
              </Tooltip>
              <Tooltip title="删除">
                <Button
                  danger
                  type="link"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record.roleId)}
                />
              </Tooltip>
              <Tooltip title="数据权限">
                <Button
                  type="link"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleDataScope(record.roleId)}
                />
              </Tooltip>
              <Tooltip title="分配用户">
                <Button
                  type="link"
                  icon={<UserOutlined />}
                  onClick={() =>
                    navigate(`/system/role-auth/user/${record.roleId}`)
                  }
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  const handleEdit = async (roleId?: string | number) => {
    if (!roleId) {
      return;
    }
    const response = await getRole(roleId);
    form.setFieldsValue({ ...initialForm, ...response.data } as RoleForm);
    await loadMenuTree(roleId);
    setDialogOpen(true);
  };

  const handleDelete = async (
    roleId?: string | number | Array<string | number>,
  ) => {
    const target = roleId || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的角色');
      return;
    }
    const confirmed = await modal.confirm(
      `是否确认删除角色编号为 "${Array.isArray(target) ? target.join(',') : target}" 数据项？`,
    );
    if (!confirmed) {
      return;
    }
    await delRole(target);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        menuIds: checkedMenuKeys,
      };
      if (values.roleId) {
        await updateRole(payload);
      } else {
        await addRole(payload);
      }
      modal.msgSuccess('操作成功');
      setDialogOpen(false);
      loadList();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDataScope = async (roleId?: string | number) => {
    if (!roleId) {
      return;
    }
    const response = await getRole(roleId);
    form.setFieldsValue({ ...initialForm, ...response.data } as RoleForm);
    await loadDeptTree(roleId);
    setScopeOpen(true);
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {showSearch && (
        <Card>
          <Form layout="inline" className="query-form">
            <Row gutter={16} style={{ width: '100%' }}>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="角色名称"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入角色名称"
                    value={query.roleName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        roleName: event.target.value,
                      }))
                    }
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next, dateRange);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="权限字符"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入权限字符"
                    value={query.roleKey}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        roleKey: event.target.value,
                      }))
                    }
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next, dateRange);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="状态"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="角色状态"
                    value={query.status || undefined}
                    options={(dict.sys_normal_disable || []).map((item) => ({
                      label: item.label,
                      value: item.value,
                    }))}
                    onChange={(value) =>
                      setQuery((prev) => ({ ...prev, status: value || '' }))
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={8}>
                <Form.Item
                  label="创建时间"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <DatePicker.RangePicker
                    showTime
                    style={{ width: '100%' }}
                    value={dateRange}
                    onChange={(value) =>
                      setDateRange((value as [Dayjs, Dayjs]) || null)
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={4}>
                <Form.Item style={{ marginBottom: 12 }}>
                  <Space>
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={() => {
                        const next = { ...query, pageNum: 1 };
                        setQuery(next);
                        loadList(next, dateRange);
                      }}
                    >
                      搜索
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        setQuery(initialQuery);
                        setDateRange(null);
                        loadList(initialQuery, null);
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
        <div className="table-toolbar">
          <Space wrap className="toolbar-buttons">
            <Button
              className="btn-plain-primary"
              icon={<PlusOutlined />}
              onClick={async () => {
                form.setFieldsValue(initialForm);
                await loadMenuTree();
                setDialogOpen(true);
              }}
            >
              新增
            </Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEdit(selectedIds[0])}
              disabled={selectedIds.length !== 1}
              style={{ color: '#67c23a', borderColor: '#b7eb8f' }}
            >
              修改
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete()}
              disabled={selectedIds.length === 0}
              style={{ borderColor: '#ffccc7' }}
            >
              删除
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                download(
                  '/system/role/export',
                  addDateRange({ ...query }, formatRange(dateRange)),
                  `role_${Date.now()}.xlsx`,
                )
              }
              style={{ color: '#e6a23c', borderColor: '#ffd591' }}
            >
              导出
            </Button>
          </Space>
          <div className="right-toolbar-wrap">
            <RightToolbar
              showSearch={showSearch}
              onShowSearchChange={setShowSearch}
              onQueryTable={() => loadList()}
            />
          </div>
        </div>

        <Table<RoleVO>
          rowKey="roleId"
          bordered
          scroll={{ x: 980 }}
          loading={loading}
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
            loadList(next, dateRange);
          }}
        />
      </Card>

      <Modal
        width={760}
        open={dialogOpen}
        title={editingRoleId ? '修改角色' : '新增角色'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Form.Item
            label="角色名称"
            name="roleName"
            rules={[{ required: true, message: '角色名称不能为空' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="权限字符"
            name="roleKey"
            rules={[{ required: true, message: '权限字符不能为空' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="角色顺序"
            name="roleSort"
            rules={[{ required: true, message: '角色顺序不能为空' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Radio.Group
              options={(dict.sys_normal_disable || []).map((item) => ({
                label: item.label,
                value: item.value,
              }))}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }} wrap>
            <Checkbox
              checked={Boolean(menuCheckStrictly)}
              onChange={(event) =>
                form.setFieldValue('menuCheckStrictly', event.target.checked)
              }
            >
              父子联动
            </Checkbox>
          </Space>
          <Tree
            checkable
            defaultExpandAll
            checkStrictly={!menuCheckStrictly}
            treeData={toTreeData(menuOptions)}
            checkedKeys={checkedMenuKeys.map(String)}
            onCheck={(keys) => {
              const nextKeys = Array.isArray(keys) ? keys : keys.checked;
              setCheckedMenuKeys(nextKeys as Array<string | number>);
            }}
          />
          <Form.Item style={{ marginTop: 16 }} label="备注" name="remark">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        width={760}
        open={scopeOpen}
        title="分配数据权限"
        onCancel={() => setScopeOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          await dataScope({
            ...values,
            deptIds: checkedDeptKeys,
          });
          modal.msgSuccess('修改成功');
          setScopeOpen(false);
          loadList();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="角色名称" name="roleName">
            <Input disabled />
          </Form.Item>
          <Form.Item label="权限字符" name="roleKey">
            <Input disabled />
          </Form.Item>
          <Form.Item label="权限范围" name="dataScope">
            <Select options={dataScopeOptions} />
          </Form.Item>
          {currentDataScope === '2' && (
            <>
              <Checkbox
                checked={Boolean(deptCheckStrictly)}
                onChange={(event) =>
                  form.setFieldValue('deptCheckStrictly', event.target.checked)
                }
              >
                父子联动
              </Checkbox>
              <Tree
                checkable
                defaultExpandAll
                checkStrictly={!deptCheckStrictly}
                treeData={toTreeData(deptOptions)}
                checkedKeys={checkedDeptKeys.map(String)}
                onCheck={(keys) => {
                  const nextKeys = Array.isArray(keys) ? keys : keys.checked;
                  setCheckedDeptKeys(nextKeys as Array<string | number>);
                }}
              />
            </>
          )}
        </Form>
      </Modal>
    </Space>
  );
}
