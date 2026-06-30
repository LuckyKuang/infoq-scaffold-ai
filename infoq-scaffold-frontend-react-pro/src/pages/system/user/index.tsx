import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  EditOutlined,
  InboxOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {useNavigate} from '@umijs/max';
import type {MenuProps} from 'antd';
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Dropdown,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tooltip,
  Tree,
  TreeSelect,
  Upload,
} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import type {DataNode} from 'antd/es/tree';
import type {UploadFile} from 'antd/es/upload/interface';
import type {Dayjs} from 'dayjs';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {DeptTreeVO} from '@/api/system/dept/types';
import {optionselect as getPostOptions} from '@/api/system/post';
import type {PostVO} from '@/api/system/post/types';
import {listRole} from '@/api/system/role';
import type {RoleQuery, RoleVO} from '@/api/system/role/types';
import {
  addUser,
  changeUserStatus,
  delUser,
  deptTreeSelect,
  getUser,
  listUser,
  resetUserPwd,
  updateUser,
} from '@/api/system/user';
import {assertUserDetailData} from '@/api/system/user/guards';
import type {UserForm, UserQuery, UserVO} from '@/api/system/user/types';
import CrudModal from '@/components/CrudModal';
import Pagination from '@/components/Pagination';
import RightToolbar, {type ToolbarColumn} from '@/components/RightToolbar';
import useDictOptions from '@/hooks/useDictOptions';
import useInitialLoadEffect from '@/hooks/useInitialLoadEffect';
import modal from '@/utils/modal';
import auth from '@/utils/permission';
import request, {download} from '@/utils/request';
import {addDateRange} from '@/utils/scaffold';

const initialQuery: UserQuery = {
  pageNum: 1,
  pageSize: 10,
  userName: '',
  nickName: '',
  phonenumber: '',
  status: '',
  deptId: '',
  roleId: '',
};

const initialForm: UserForm = {
  userId: undefined,
  deptId: undefined,
  userName: '',
  nickName: '',
  password: '',
  phonenumber: '',
  email: '',
  sex: '0',
  status: '0',
  remark: '',
  postIds: [],
  roleIds: [],
};

const formatRange = (range: [Dayjs, Dayjs] | null) =>
  range
    ? [
        range[0].format('YYYY-MM-DD HH:mm:ss'),
        range[1].format('YYYY-MM-DD HH:mm:ss'),
      ]
    : [];

const toImportResultLines = (message?: string) => {
  const cleaned = (message || '导入成功')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
  const seen = new Map<string, number>();

  return cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => {
      const count = seen.get(text) ?? 0;
      seen.set(text, count + 1);
      return {
        key: `${text}-${count}`,
        text,
      };
    });
};

const toTreeData = (nodes: DeptTreeVO[]): DataNode[] =>
  nodes.map((node) => ({
    key: String(node.id),
    title: node.label,
    children: node.children?.length ? toTreeData(node.children) : undefined,
  }));

type TreeSelectOption = {
  value: string | number;
  title: string;
  children?: TreeSelectOption[];
};

const toTreeSelectData = (nodes: DeptTreeVO[]): TreeSelectOption[] =>
  nodes.map((node) => ({
    value: node.id,
    title: node.label,
    children: node.children?.length
      ? toTreeSelectData(node.children)
      : undefined,
  }));

const filterDeptTree = (nodes: DeptTreeVO[], keyword: string): DeptTreeVO[] => {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return nodes;
  }

  return nodes.reduce<DeptTreeVO[]>((result, node) => {
    const matchedChildren = node.children
      ? filterDeptTree(node.children, normalizedKeyword)
      : [];
    if (node.label.includes(normalizedKeyword) || matchedChildren.length > 0) {
      result.push({
        ...node,
        children: matchedChildren,
      });
    }
    return result;
  }, []);
};

const filterDisabledDeptTree = (nodes: DeptTreeVO[]): DeptTreeVO[] =>
  nodes.reduce<DeptTreeVO[]>((result, node) => {
    if (node.disabled) {
      return result;
    }

    result.push({
      ...node,
      children: node.children?.length
        ? filterDisabledDeptTree(node.children)
        : [],
    });

    return result;
  }, []);

const collectDeptKeys = (nodes: DeptTreeVO[]): string[] =>
  nodes.flatMap((node) => [
    String(node.id),
    ...(node.children ? collectDeptKeys(node.children) : []),
  ]);

type UserTableColumn = ColumnsType<UserVO>[number] & {
  hidden?: boolean;
};

export default function UserPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState<UserQuery>(initialQuery);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [deptName, setDeptName] = useState('');
  const [list, setList] = useState<UserVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [deptTree, setDeptTree] = useState<DeptTreeVO[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleVO[]>([]);
  const [postOptions, setPostOptions] = useState<PostVO[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeUserId, setActiveUserId] = useState<
    string | number | undefined
  >();
  const [selectedDeptId, setSelectedDeptId] = useState<string>();
  const [importOpen, setImportOpen] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importUpdateSupport, setImportUpdateSupport] = useState(false);
  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);
  const [expandedDeptKeys, setExpandedDeptKeys] = useState<string[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(false);
  const [columns, setColumns] = useState<ToolbarColumn[]>([
    { key: 'userId', label: '用户编号', visible: false },
    { key: 'userName', label: '用户名称', visible: true },
    { key: 'nickName', label: '用户昵称', visible: true },
    { key: 'deptName', label: '部门', visible: true },
    { key: 'phonenumber', label: '手机号码', visible: true },
    { key: 'status', label: '状态', visible: true },
    { key: 'createTime', label: '创建时间', visible: true },
  ]);
  const [form] = Form.useForm<UserForm>();
  const [pwdForm] = Form.useForm<{ password: string }>();
  const editingUserId = Form.useWatch('userId', form);
  const dict = useDictOptions('sys_normal_disable', 'sys_user_sex');
  const filteredDeptTree = useMemo(
    () => filterDeptTree(deptTree, deptName),
    [deptName, deptTree],
  );
  const enabledDeptTree = useMemo(
    () => filterDisabledDeptTree(deptTree),
    [deptTree],
  );
  const visibleColumnKeys = useMemo(
    () =>
      new Set(columns.filter((item) => item.visible).map((item) => item.key)),
    [columns],
  );

  const loadDeptTree = useCallback(async () => {
    const response = await deptTreeSelect();
    setDeptTree(response.data);
  }, []);

  const loadList = useCallback(
    async (nextQuery: UserQuery, nextRange: [Dayjs, Dayjs] | null) => {
      setLoading(true);
      try {
        const response = await listUser(
          addDateRange({ ...nextQuery }, formatRange(nextRange)),
        );
        setList(response.rows);
        setTotal(response.total);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadBaseOptions = useCallback(async (deptId?: string | number) => {
    const [roleResponse, postResponse] = await Promise.all([
      listRole({
        pageNum: 1,
        pageSize: 999,
        roleName: '',
        roleKey: '',
        status: '0',
      } as RoleQuery),
      getPostOptions(deptId),
    ]);
    setRoleOptions(roleResponse.rows);
    setPostOptions(postResponse.data);
  }, []);

  useInitialLoadEffect(
    () => {
      loadDeptTree();
      loadList(initialQuery, null);
      loadBaseOptions();
    },
    [loadBaseOptions, loadDeptTree, loadList],
    {
      dedupeKey: 'system-user-initial-list',
    },
  );

  useEffect(() => {
    setExpandedDeptKeys(collectDeptKeys(deptTree));
    setAutoExpandParent(false);
  }, [deptTree]);

  useEffect(() => {
    if (deptName.trim()) {
      setExpandedDeptKeys(collectDeptKeys(filteredDeptTree));
      setAutoExpandParent(true);
      return;
    }

    setAutoExpandParent(false);
  }, [deptName, filteredDeptTree]);

  const moreActions: MenuProps['items'] = [
    {
      key: 'template',
      icon: <DownloadOutlined />,
      label: '下载模板',
    },
    ...(auth.hasPermiOr(['system:user:import'])
      ? [
          {
            key: 'import',
            icon: <UploadOutlined />,
            label: '导入数据',
          },
        ]
      : []),
    ...(auth.hasPermiOr(['system:user:export'])
      ? [
          {
            key: 'export',
            icon: <DownloadOutlined />,
            label: '导出数据',
          },
        ]
      : []),
  ];

  const handleEdit = useCallback(
    async (userId?: string | number) => {
      if (!userId) {
        return;
      }
      const response = await getUser(userId);
      const data = assertUserDetailData(response.data);
      setRoleOptions(data.roles);
      setPostOptions(data.posts);
      form.resetFields();
      form.setFieldsValue({
        userId: String(data.user.userId),
        deptId: data.user.deptId,
        userName: data.user.userName,
        nickName: data.user.nickName,
        phonenumber: data.user.phonenumber,
        email: data.user.email,
        sex: data.user.sex,
        status: data.user.status,
        remark: data.user.remark,
        roleIds: data.roleIds,
        postIds: data.postIds,
      });
      setDialogOpen(true);
    },
    [form],
  );

  const handleDelete = useCallback(
    async (userId?: string | number | Array<string | number>) => {
      const target = userId || selectedIds;
      if (!target || (Array.isArray(target) && target.length === 0)) {
        modal.msgWarning('请选择要删除的用户');
        return;
      }
      const confirmed = await modal.confirm(
        `是否确认删除用户编号为 "${Array.isArray(target) ? target.join(',') : target}" 的数据项？`,
      );
      if (!confirmed) {
        return;
      }
      await delUser(target);
      modal.msgSuccess('删除成功');
      setSelectedIds([]);
      loadList(query, dateRange);
    },
    [dateRange, loadList, query, selectedIds],
  );

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.userId) {
        await updateUser(values);
      } else {
        await addUser(values);
      }
      modal.msgSuccess('操作成功');
      setDialogOpen(false);
      loadList(query, dateRange);
    } finally {
      setSubmitting(false);
    }
  }, [dateRange, form, loadList, query]);

  const handleAdd = useCallback(async () => {
    const response = await getUser();
    const data = response.data;
    if (!data || !Array.isArray(data.roles)) {
      modal.msgError('用户新增选项响应格式错误：roles 必须是数组');
      return;
    }
    setRoleOptions(data.roles);
    setPostOptions((current) =>
      Array.isArray(data.posts) ? data.posts : current,
    );
    form.resetFields();
    form.setFieldsValue(initialForm);
    setDialogOpen(true);
  }, [form]);

  const handleQuery = useCallback(() => {
    const next = { ...query, pageNum: 1 };
    setQuery(next);
    loadList(next, dateRange);
  }, [dateRange, loadList, query]);

  const handleResetQuery = useCallback(() => {
    setQuery(initialQuery);
    setDateRange(null);
    setSelectedDeptId(undefined);
    loadList(initialQuery, null);
  }, [loadList]);

  const closeImportDialog = useCallback(() => {
    setImportOpen(false);
    setImportSubmitting(false);
    setImportUpdateSupport(false);
    setImportFileList([]);
  }, []);

  const handleImportSubmit = useCallback(async () => {
    if (importFileList.length === 0) {
      modal.msgWarning('请选择需要导入的文件');
      return;
    }

    const formData = new FormData();
    const file = importFileList[0].originFileObj;

    if (!file) {
      modal.msgWarning('未获取到上传文件');
      return;
    }

    formData.append('file', file);
    setImportSubmitting(true);

    try {
      const response = (await request({
        url: `/system/user/importData?updateSupport=${importUpdateSupport ? 1 : 0}`,
        method: 'post',
        headers: {
          repeatSubmit: false,
        },
        data: formData,
      })) as { msg?: string };

      closeImportDialog();
      Modal.info({
        title: '导入结果',
        width: 560,
        okText: '确定',
        content: (
          <div
            style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: 8 }}
          >
            {toImportResultLines(response.msg).map((line) => (
              <div key={line.key}>{line.text}</div>
            ))}
          </div>
        ),
      });
      loadList(initialQuery, null);
    } finally {
      setImportSubmitting(false);
    }
  }, [closeImportDialog, importFileList, importUpdateSupport, loadList]);

  const tableColumns = useMemo<ColumnsType<UserVO>>(() => {
    const nextColumns: UserTableColumn[] = [
      {
        title: '用户编号',
        dataIndex: 'userId',
        width: 100,
        align: 'center' as const,
        hidden: !visibleColumnKeys.has('userId'),
      },
      {
        title: '用户名称',
        dataIndex: 'userName',
        width: 120,
        align: 'center' as const,
        hidden: !visibleColumnKeys.has('userName'),
      },
      {
        title: '用户昵称',
        dataIndex: 'nickName',
        width: 120,
        align: 'center' as const,
        ellipsis: true,
        hidden: !visibleColumnKeys.has('nickName'),
      },
      {
        title: '部门',
        dataIndex: 'deptName',
        width: 130,
        align: 'center' as const,
        ellipsis: true,
        hidden: !visibleColumnKeys.has('deptName'),
      },
      {
        title: '手机号码',
        dataIndex: 'phonenumber',
        width: 120,
        align: 'center' as const,
        hidden: !visibleColumnKeys.has('phonenumber'),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 90,
        align: 'center' as const,
        hidden: !visibleColumnKeys.has('status'),
        render: (value: string, record) => (
          <Switch
            checked={value === '0'}
            disabled={record.userId === 1}
            onChange={async (checked) => {
              const nextStatus = checked ? '0' : '1';
              const confirmed = await modal.confirm(
                `确认要${nextStatus === '0' ? '启用' : '停用'} "${record.userName}" 用户吗？`,
              );
              if (!confirmed) {
                return;
              }
              await changeUserStatus(record.userId, nextStatus);
              modal.msgSuccess('状态修改成功');
              loadList(query, dateRange);
            }}
          />
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createTime',
        width: 180,
        align: 'center' as const,
        hidden: !visibleColumnKeys.has('createTime'),
      },
      {
        title: '操作',
        key: 'action',
        width: 180,
        align: 'center' as const,
        fixed: 'right' as const,
        render: (_, record) => (
          <Space size={4}>
            {record.userId !== 1 && auth.hasPermiOr(['system:user:edit']) && (
              <Tooltip title="修改">
                <Button
                  className="table-action-link"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record.userId)}
                />
              </Tooltip>
            )}
            {record.userId !== 1 && auth.hasPermiOr(['system:user:remove']) && (
              <Tooltip title="删除">
                <Button
                  className="table-action-link"
                  type="link"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record.userId)}
                />
              </Tooltip>
            )}
            {record.userId !== 1 &&
              auth.hasPermiOr(['system:user:resetPwd']) && (
                <Tooltip title="重置密码">
                  <Button
                    className="table-action-link"
                    type="link"
                    icon={<KeyOutlined />}
                    onClick={() => {
                      setActiveUserId(record.userId);
                      pwdForm.setFieldsValue({ password: '' });
                      setPwdDialogOpen(true);
                    }}
                  />
                </Tooltip>
              )}
            {record.userId !== 1 && auth.hasPermiOr(['system:user:edit']) && (
              <Tooltip title="分配角色">
                <Button
                  className="table-action-link"
                  type="link"
                  icon={<CheckCircleOutlined />}
                  onClick={() =>
                    navigate(`/system/user-auth/role/${record.userId}`)
                  }
                />
              </Tooltip>
            )}
          </Space>
        ),
      },
    ];

    return nextColumns.filter((column) => !column.hidden);
  }, [
    dateRange,
    handleDelete,
    handleEdit,
    loadList,
    navigate,
    pwdForm,
    query,
    visibleColumnKeys,
  ]);

  return (
    <Row gutter={16}>
      <Col xs={24} xl={5}>
        <Card>
          <Input
            allowClear
            placeholder="请输入部门名称"
            prefix={<SearchOutlined />}
            value={deptName}
            onChange={(event) => setDeptName(event.target.value)}
          />
          <Tree
            style={{ marginTop: 12 }}
            treeData={toTreeData(filteredDeptTree)}
            virtual={false}
            blockNode
            expandedKeys={expandedDeptKeys}
            autoExpandParent={autoExpandParent}
            selectedKeys={selectedDeptId ? [selectedDeptId] : []}
            onExpand={(keys) => {
              setExpandedDeptKeys(keys as string[]);
              setAutoExpandParent(false);
            }}
            onSelect={(keys) => {
              const nextDeptId = keys[0] ? String(keys[0]) : undefined;
              setSelectedDeptId(nextDeptId);
              const next = {
                ...query,
                deptId: nextDeptId || '',
              };
              setQuery(next);
              loadList(next, dateRange);
            }}
          />
        </Card>
      </Col>
      <Col xs={24} xl={19}>
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
                        onPressEnter={handleQuery}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} xl={6}>
                    <Form.Item
                      label="用户昵称"
                      style={{ width: '100%', marginBottom: 12 }}
                    >
                      <Input
                        allowClear
                        placeholder="请输入用户昵称"
                        value={query.nickName}
                        onChange={(event) =>
                          setQuery((prev) => ({
                            ...prev,
                            nickName: event.target.value,
                          }))
                        }
                        onPressEnter={handleQuery}
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
                        onPressEnter={handleQuery}
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
                        placeholder="用户状态"
                        value={query.status || undefined}
                        options={(dict.sys_normal_disable || []).map(
                          (item) => ({ label: item.label, value: item.value }),
                        )}
                        onChange={(value) =>
                          setQuery((prev) => ({ ...prev, status: value || '' }))
                        }
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={16} xl={8}>
                    <Form.Item
                      label="创建时间"
                      style={{ width: '100%', marginBottom: 0 }}
                    >
                      <DatePicker.RangePicker
                        showTime
                        placeholder={['开始日期', '结束日期']}
                        style={{ width: '100%' }}
                        value={dateRange}
                        onChange={(value) =>
                          setDateRange((value as [Dayjs, Dayjs]) || null)
                        }
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8} xl={4}>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Space>
                        <Button
                          type="primary"
                          icon={<SearchOutlined />}
                          onClick={handleQuery}
                        >
                          搜索
                        </Button>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={handleResetQuery}
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
                {auth.hasPermiOr(['system:user:add']) && (
                  <Button
                    className="btn-plain-primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                  >
                    新增
                  </Button>
                )}
                {auth.hasPermiOr(['system:user:edit']) && (
                  <Button
                    className="btn-plain-success"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(selectedIds[0])}
                    disabled={selectedIds.length !== 1}
                  >
                    修改
                  </Button>
                )}
                {auth.hasPermiOr(['system:user:remove']) && (
                  <Button
                    className="btn-plain-danger"
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete()}
                    disabled={selectedIds.length === 0}
                  >
                    删除
                  </Button>
                )}
                <Dropdown
                  menu={{
                    items: moreActions,
                    onClick: ({ key }) => {
                      if (key === 'template') {
                        download(
                          '/system/user/importTemplate',
                          {},
                          `user_template_${Date.now()}.xlsx`,
                        );
                      }
                      if (key === 'import') {
                        setImportOpen(true);
                      }
                      if (key === 'export') {
                        download(
                          '/system/user/export',
                          addDateRange({ ...query }, formatRange(dateRange)),
                          `user_${Date.now()}.xlsx`,
                        );
                      }
                    },
                  }}
                >
                  <Button>
                    更多
                    <DownOutlined />
                  </Button>
                </Dropdown>
              </Space>
              <div className="right-toolbar-wrap">
                <RightToolbar
                  search
                  showSearch={showSearch}
                  columns={columns}
                  onShowSearchChange={setShowSearch}
                  onQueryTable={() => loadList(query, dateRange)}
                  onColumnsChange={setColumns}
                />
              </div>
            </div>

            <Table<UserVO>
              rowKey="userId"
              bordered
              loading={loading}
              columns={tableColumns}
              dataSource={list}
              pagination={false}
              rowSelection={{
                selectedRowKeys: selectedIds,
                columnWidth: 50,
                onChange: (keys) =>
                  setSelectedIds(keys as Array<string | number>),
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
        </Space>
      </Col>

      <CrudModal
        width={860}
        open={dialogOpen}
        title={editingUserId ? '修改用户' : '新增用户'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="用户昵称"
                name="nickName"
                rules={[{ required: true, message: '用户昵称不能为空' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="归属部门" name="deptId">
                <TreeSelect
                  treeData={toTreeSelectData(enabledDeptTree)}
                  placeholder="请选择归属部门"
                  allowClear
                  treeDefaultExpandAll
                  onChange={(value) => {
                    loadBaseOptions(value as string | number);
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="手机号码"
                name="phonenumber"
                rules={[
                  {
                    pattern: /^1[3456789][0-9]\d{8}$/,
                    message: '请输入正确的手机号码',
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="邮箱"
                name="email"
                rules={[{ type: 'email', message: '请输入正确的邮箱地址' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            {!editingUserId && (
              <>
                <Col span={12}>
                  <Form.Item
                    label="用户名称"
                    name="userName"
                    rules={[
                      { required: true, message: '用户名称不能为空' },
                      {
                        min: 2,
                        max: 20,
                        message: '用户名称长度必须介于 2 和 20 之间',
                      },
                    ]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="用户密码"
                    name="password"
                    rules={[
                      { required: true, message: '用户密码不能为空' },
                      {
                        min: 5,
                        max: 20,
                        message: '用户密码长度必须介于 5 和 20 之间',
                      },
                    ]}
                  >
                    <Input.Password />
                  </Form.Item>
                </Col>
              </>
            )}
            <Col span={12}>
              <Form.Item label="用户性别" name="sex">
                <Radio.Group
                  options={(dict.sys_user_sex || []).map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="状态" name="status">
                <Radio.Group
                  options={(dict.sys_normal_disable || []).map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="岗位" name="postIds">
                <Select
                  mode="multiple"
                  options={postOptions.map((item) => ({
                    label: item.postName,
                    value: item.postId,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="角色"
                name="roleIds"
                rules={[{ required: true, message: '用户角色不能为空' }]}
              >
                <Select
                  mode="multiple"
                  options={roleOptions.map((item) => ({
                    label: item.roleName,
                    value: item.roleId,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={4} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </CrudModal>

      <CrudModal
        open={importOpen}
        title="用户导入"
        width={400}
        okText="确定"
        cancelText="取消"
        confirmLoading={importSubmitting}
        okButtonProps={{ disabled: importFileList.length === 0 }}
        onCancel={closeImportDialog}
        onOk={handleImportSubmit}
      >
        <Upload.Dragger
          accept=".xlsx,.xls"
          maxCount={1}
          multiple={false}
          fileList={importFileList}
          beforeUpload={() => false}
          onChange={(info) => {
            setImportFileList(info.fileList.slice(-1));
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">将文件拖到此处，或点击上传</p>
          <p className="ant-upload-hint">仅允许导入 xls、xlsx 格式文件。</p>
        </Upload.Dragger>
        <div style={{ marginTop: 16 }}>
          <Checkbox
            checked={importUpdateSupport}
            onChange={(event) => setImportUpdateSupport(event.target.checked)}
          >
            是否更新已经存在的用户数据
          </Checkbox>
        </div>
        <div
          style={{ marginTop: 8, fontSize: 12, color: 'rgba(0, 0, 0, 0.45)' }}
        >
          下载模板后按格式填写，再执行导入。
          <Button
            type="link"
            size="small"
            style={{ paddingInline: 6 }}
            onClick={() =>
              download(
                '/system/user/importTemplate',
                {},
                `user_template_${Date.now()}.xlsx`,
              )
            }
          >
            下载模板
          </Button>
        </div>
      </CrudModal>

      <CrudModal
        open={pwdDialogOpen}
        title="重置密码"
        confirmLoading={pwdSubmitting}
        onCancel={() => setPwdDialogOpen(false)}
        onOk={async () => {
          const values = await pwdForm.validateFields();
          if (!activeUserId) {
            return;
          }
          setPwdSubmitting(true);
          try {
            await resetUserPwd(activeUserId, values.password);
            modal.msgSuccess(`修改成功，新密码是：${values.password}`);
            setPwdDialogOpen(false);
          } finally {
            setPwdSubmitting(false);
          }
        }}
      >
        <Form form={pwdForm} layout="vertical" initialValues={{ password: '' }}>
          <Form.Item
            label="新密码"
            name="password"
            rules={[
              { required: true, message: '新密码不能为空' },
              { min: 5, max: 20, message: '用户密码长度必须介于 5 和 20 之间' },
              {
                pattern: /^[^<>"'|\\]+$/,
                message: '不能包含非法字符：< > " \' \\ |',
              },
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </CrudModal>
    </Row>
  );
}
