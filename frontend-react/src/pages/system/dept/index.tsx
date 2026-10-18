import { useCallback, useEffect, useState } from 'react';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Radio, Row, Select, Space, Table, Tooltip, TreeSelect } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import useDictOptions from '@/hooks/useDictOptions';
import { addDept, delDept, getDept, listDept, listDeptExcludeChild, updateDept } from '@/api/system/dept';
import type { DeptForm, DeptQuery, DeptVO } from '@/api/system/dept/types';
import { listUserByDeptId } from '@/api/system/user';
import type { UserVO } from '@/api/system/user/types';
import RightToolbar from '@/components/RightToolbar';
import DictTag from '@/components/DictTag';
import CrudModal from '@/components/CrudModal';
import modal from '@/utils/modal';
import auth from '@/utils/permission';
import { handleTree } from '@/utils/scaffold';

const initialQuery: DeptQuery = {
  pageNum: 1,
  pageSize: 10,
  deptName: '',
  deptCategory: '',
  status: undefined
};

const initialForm: DeptForm = {
  deptId: undefined,
  parentId: undefined,
  deptName: '',
  deptCategory: '',
  orderNum: 0,
  leader: '',
  phone: '',
  email: '',
  status: '0'
};

const toTreeSelectData = (nodes: DeptVO[]) =>
  nodes.map((node) => ({
    value: node.deptId,
    title: node.deptName,
    children: node.children?.length ? toTreeSelectData(node.children) : undefined
  }));

const collectDeptIds = (nodes: DeptVO[]): Array<string | number> =>
  nodes.flatMap((node) => (node.children?.length ? [node.deptId, ...collectDeptIds(node.children)] : []));

const isRootParentId = (value?: string | number | null) => value === undefined || value === null || value === '' || value === 0 || value === '0';

export default function DeptPage() {
  const [query, setQuery] = useState<DeptQuery>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<DeptVO[]>([]);
  const [deptOptions, setDeptOptions] = useState<DeptVO[]>([]);
  const [deptUsers, setDeptUsers] = useState<UserVO[]>([]);
  const [expandAll, setExpandAll] = useState(true);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Array<string | number>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<DeptForm>();
  const deptId = Form.useWatch('deptId', { form, preserve: true });
  const parentId = Form.useWatch('parentId', { form, preserve: true });
  const showParentDept = !deptId || !isRootParentId(parentId);
  const dict = useDictOptions('sys_normal_disable');

  const loadList = useCallback(
    async (nextQuery: DeptQuery) => {
      setLoading(true);
      try {
        const response = await listDept(nextQuery);
        const treeData = handleTree<DeptVO>(response.data, 'deptId');
        setList(treeData);
        setExpandedRowKeys(expandAll ? collectDeptIds(treeData) : []);
      } finally {
        setLoading(false);
      }
    },
    [expandAll]
  );

  const loadDeptOptions = useCallback(async () => {
    const response = await listDept();
    setDeptOptions(handleTree<DeptVO>(response.data, 'deptId'));
  }, []);

  const loadDeptUsers = useCallback(async (deptId?: string | number) => {
    if (deptId === undefined || deptId === null || deptId === '') {
      setDeptUsers([]);
      return;
    }
    const response = await listUserByDeptId(deptId);
    setDeptUsers(response.data);
  }, []);

  useEffect(() => {
    loadList(initialQuery);
    loadDeptOptions();
  }, [loadDeptOptions, loadList]);

  const columns: ColumnsType<DeptVO> = [
    {
      title: '部门名称',
      dataIndex: 'deptName',
      width: 260
    },
    {
      title: '类别编码',
      dataIndex: 'deptCategory',
      width: 200,
      align: 'center'
    },
    {
      title: '排序',
      dataIndex: 'orderNum',
      width: 200,
      align: 'center'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      align: 'center',
      render: (value: string) => <DictTag options={dict.sys_normal_disable || []} value={value} />
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 200,
      align: 'center'
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          {auth.hasPermiOr(['system:dept:edit']) && (
            <Tooltip title="修改">
              <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record.deptId)} />
            </Tooltip>
          )}
          {auth.hasPermiOr(['system:dept:add']) && (
            <Tooltip title="新增">
              <Button type="link" icon={<PlusOutlined />} onClick={() => handleAdd(record.deptId)} />
            </Tooltip>
          )}
          {auth.hasPermiOr(['system:dept:remove']) && (
            <Tooltip title="删除">
              <Button danger type="link" icon={<DeleteOutlined />} onClick={() => handleDelete(record.deptId, record.deptName)} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const handleAdd = async (parentId?: string | number) => {
    form.setFieldsValue({
      ...initialForm,
      parentId
    });
    await loadDeptOptions();
    await loadDeptUsers(parentId);
    setDialogOpen(true);
  };

  const handleEdit = async (deptId?: string | number) => {
    if (!deptId) {
      return;
    }
    const detailResponse = await getDept(deptId);
    const detail = { ...initialForm, ...detailResponse.data } as DeptForm;
    const optionsResponse = await listDeptExcludeChild(deptId);
    setDeptOptions(handleTree<DeptVO>(optionsResponse.data, 'deptId'));
    await loadDeptUsers(detail.deptId);
    form.setFieldsValue(detail);
    setDialogOpen(true);
  };

  const handleDelete = async (deptId?: string | number, deptName?: string) => {
    if (!deptId) {
      return;
    }
    const confirmed = await modal.confirm(`是否确认删除名称为 "${deptName || deptId}" 的数据项？`);
    if (!confirmed) {
      return;
    }
    await delDept(deptId);
    modal.msgSuccess('删除成功');
    loadList(query);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.deptId) {
        await updateDept(values);
      } else {
        await addDept(values);
      }
      modal.msgSuccess('操作成功');
      setDialogOpen(false);
      loadList(query);
      loadDeptOptions();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {showSearch && (
        <Card>
          <Form layout="inline" className="query-form">
            <Row gutter={16} style={{ width: '100%' }}>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="部门名称" style={{ width: '100%', marginBottom: 12 }}>
                  <Input
                    allowClear
                    placeholder="请输入部门名称"
                    value={query.deptName}
                    onChange={(event) => setQuery((prev) => ({ ...prev, deptName: event.target.value }))}
                    onPressEnter={() => loadList({ ...query, pageNum: 1 })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="类别编码" style={{ width: '100%', marginBottom: 12 }}>
                  <Input
                    allowClear
                    placeholder="请输入类别编码"
                    value={query.deptCategory}
                    onChange={(event) => setQuery((prev) => ({ ...prev, deptCategory: event.target.value }))}
                    onPressEnter={() => loadList({ ...query, pageNum: 1 })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="状态" style={{ width: '100%', marginBottom: 12 }}>
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="部门状态"
                    value={query.status}
                    options={(dict.sys_normal_disable || []).map((item) => ({ label: item.label, value: item.value }))}
                    onChange={(value) => setQuery((prev) => ({ ...prev, status: value as number | undefined }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Space>
                    <Button type="primary" icon={<SearchOutlined />} onClick={() => loadList({ ...query, pageNum: 1 })}>
                      搜索
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        setQuery(initialQuery);
                        loadList(initialQuery);
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
            {auth.hasPermiOr(['system:dept:add']) && (
              <Button className="btn-plain-primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
                新增
              </Button>
            )}
            <Button
              icon={<SortAscendingOutlined />}
              onClick={() => {
                const nextExpand = !expandAll;
                setExpandAll(nextExpand);
                setExpandedRowKeys(nextExpand ? collectDeptIds(list) : []);
              }}
            >
              展开/折叠
            </Button>
          </Space>
          <div className="right-toolbar-wrap">
            <RightToolbar showSearch={showSearch} onShowSearchChange={setShowSearch} onQueryTable={() => loadList(query)} />
          </div>
        </div>
        <Table<DeptVO>
          rowKey="deptId"
          loading={loading}
          bordered
          columns={columns}
          dataSource={list}
          pagination={false}
          expandable={{
            rowExpandable: (record) => Array.isArray(record.children) && record.children.length > 0,
            expandedRowKeys,
            onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as Array<string | number>)
          }}
        />
      </Card>

      <CrudModal
        width={600}
        open={dialogOpen}
        transitionName=""
        title={deptId ? '修改部门' : '新增部门'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Form.Item name="deptId" hidden>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            {showParentDept && (
              <Col span={24}>
                <Form.Item label="上级部门" name="parentId" rules={[{ required: true, message: '上级部门不能为空' }]}>
                  <TreeSelect treeData={toTreeSelectData(deptOptions)} placeholder="选择上级部门" allowClear treeDefaultExpandAll />
                </Form.Item>
              </Col>
            )}
            <Col span={12}>
              <Form.Item label="部门名称" name="deptName" rules={[{ required: true, message: '部门名称不能为空' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="类别编码" name="deptCategory">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="显示排序" name="orderNum" rules={[{ required: true, message: '显示排序不能为空' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="负责人" name="leader">
                <Select
                  allowClear
                  options={deptUsers.map((item) => ({ label: item.userName, value: item.userId }))}
                  onOpenChange={(open) => {
                    if (open) {
                      loadDeptUsers(isRootParentId(parentId) ? deptId : parentId);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系电话" name="phone" rules={[{ pattern: /^1[3456789][0-9]\d{8}$/, message: '请输入正确的手机号码' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '请输入正确的邮箱地址' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="部门状态" name="status">
                <Radio.Group options={(dict.sys_normal_disable || []).map((item) => ({ label: item.label, value: item.value }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </CrudModal>
    </Space>
  );
}
