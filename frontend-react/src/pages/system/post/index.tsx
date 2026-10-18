import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Radio, Row, Select, Space, Table, Tooltip, Tree, TreeSelect } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { ColumnsType } from 'antd/es/table';
import useDictOptions from '@/hooks/useDictOptions';
import { addPost, delPost, deptTreeSelect, getPost, listPost, updatePost } from '@/api/system/post';
import type { PostForm, PostQuery, PostVO } from '@/api/system/post/types';
import type { DeptTreeVO } from '@/api/system/dept/types';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import DictTag from '@/components/DictTag';
import CrudModal from '@/components/CrudModal';
import modal from '@/utils/modal';
import auth from '@/utils/permission';
import { download } from '@/utils/request';

const initialQuery: PostQuery = {
  pageNum: 1,
  pageSize: 10,
  deptId: '',
  belongDeptId: '',
  postCode: '',
  postName: '',
  postCategory: '',
  status: ''
};

const initialForm: PostForm = {
  postId: undefined,
  deptId: undefined,
  postCode: '',
  postName: '',
  postCategory: '',
  postSort: 0,
  status: '0',
  remark: ''
};

const toTreeData = (nodes: DeptTreeVO[]): DataNode[] =>
  nodes.map((node) => ({
    key: String(node.id),
    title: node.label,
    children: node.children?.length ? toTreeData(node.children) : undefined
  }));

const toSelectTree = (nodes: DeptTreeVO[]) =>
  nodes.map((node) => ({
    value: node.id,
    title: node.label,
    children: node.children?.length ? toSelectTree(node.children) : undefined
  }));

const filterDeptTree = (nodes: DeptTreeVO[], keyword: string): DeptTreeVO[] => {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return nodes;
  }

  return nodes.reduce<DeptTreeVO[]>((result, node) => {
    const children = node.children ? filterDeptTree(node.children, normalizedKeyword) : [];
    if (node.label.includes(normalizedKeyword) || children.length > 0) {
      result.push({
        ...node,
        children
      });
    }
    return result;
  }, []);
};

const collectDeptKeys = (nodes: DeptTreeVO[]): string[] =>
  nodes.flatMap((node) => [String(node.id), ...(node.children ? collectDeptKeys(node.children) : [])]);

export default function PostPage() {
  const [query, setQuery] = useState<PostQuery>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<PostVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [deptTree, setDeptTree] = useState<DeptTreeVO[]>([]);
  const [deptName, setDeptName] = useState('');
  const [expandedDeptKeys, setExpandedDeptKeys] = useState<string[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<PostForm>();
  const postId = Form.useWatch('postId', form);
  const dict = useDictOptions('sys_normal_disable');
  const filteredDeptTree = useMemo(() => filterDeptTree(deptTree, deptName), [deptName, deptTree]);

  const loadTree = useCallback(async () => {
    const response = await deptTreeSelect();
    setDeptTree(response.data);
  }, []);

  const loadList = useCallback(async (nextQuery: PostQuery) => {
    setLoading(true);
    try {
      const response = await listPost(nextQuery);
      setList(response.rows);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
    loadList(initialQuery);
  }, [loadList, loadTree]);

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

  const columns: ColumnsType<PostVO> = [
    { title: '岗位编码', dataIndex: 'postCode', align: 'center', ellipsis: true },
    { title: '类别编码', dataIndex: 'postCategory', align: 'center', ellipsis: true },
    { title: '岗位名称', dataIndex: 'postName', align: 'center', ellipsis: true },
    { title: '部门', dataIndex: 'deptName', align: 'center', ellipsis: true },
    { title: '排序', dataIndex: 'postSort', width: 80, align: 'center' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      align: 'center',
      render: (value: string) => <DictTag options={dict.sys_normal_disable || []} value={value} />
    },
    { title: '创建时间', dataIndex: 'createTime', width: 180, align: 'center' },
    {
      title: '操作',
      key: 'action',
      width: 160,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          {auth.hasPermiOr(['system:post:edit']) && (
            <Tooltip title="修改">
              <Button className="table-action-link" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record.postId)} />
            </Tooltip>
          )}
          {auth.hasPermiOr(['system:post:remove']) && (
            <Tooltip title="删除">
              <Button className="table-action-link" type="link" icon={<DeleteOutlined />} onClick={() => handleDelete(record.postId)} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const handleEdit = async (postId?: string | number) => {
    if (!postId) {
      return;
    }
    const response = await getPost(postId);
    form.setFieldsValue({ ...initialForm, ...response.data });
    setDialogOpen(true);
  };

  const handleDelete = async (postId?: string | number | Array<string | number>) => {
    const target = postId || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的岗位');
      return;
    }
    const confirmed = await modal.confirm(`是否确认删除岗位编号为 "${Array.isArray(target) ? target.join(',') : target}" 的数据项？`);
    if (!confirmed) {
      return;
    }
    await delPost(target);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList(query);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.postId) {
        await updatePost(values);
      } else {
        await addPost(values);
      }
      modal.msgSuccess('操作成功');
      setDialogOpen(false);
      loadList(query);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Row gutter={16}>
      <Col xs={24} xl={5}>
        <Card>
          <Input
            allowClear
            placeholder="请输入部门名称"
            value={deptName}
            onChange={(event) => setDeptName(event.target.value)}
            style={{ marginBottom: 12 }}
          />
          <Tree
            treeData={toTreeData(filteredDeptTree)}
            virtual={false}
            expandedKeys={expandedDeptKeys}
            autoExpandParent={autoExpandParent}
            onExpand={(keys) => {
              setExpandedDeptKeys(keys as string[]);
              setAutoExpandParent(false);
            }}
            onSelect={(keys) => {
              const next = {
                ...query,
                belongDeptId: keys[0] ? String(keys[0]) : '',
                deptId: ''
              };
              setQuery(next);
              loadList(next);
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
                    <Form.Item label="岗位编码" style={{ width: '100%', marginBottom: 12 }}>
                      <Input
                        allowClear
                        placeholder="请输入岗位编码"
                        value={query.postCode}
                        onChange={(event) => setQuery((prev) => ({ ...prev, postCode: event.target.value }))}
                        onPressEnter={() => {
                          const next = { ...query, pageNum: 1 };
                          setQuery(next);
                          loadList(next);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} xl={6}>
                    <Form.Item label="类别编码" style={{ width: '100%', marginBottom: 12 }}>
                      <Input
                        allowClear
                        placeholder="请输入类别编码"
                        value={query.postCategory}
                        onChange={(event) => setQuery((prev) => ({ ...prev, postCategory: event.target.value }))}
                        onPressEnter={() => {
                          const next = { ...query, pageNum: 1 };
                          setQuery(next);
                          loadList(next);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} xl={6}>
                    <Form.Item label="岗位名称" style={{ width: '100%', marginBottom: 12 }}>
                      <Input
                        allowClear
                        placeholder="请输入岗位名称"
                        value={query.postName}
                        onChange={(event) => setQuery((prev) => ({ ...prev, postName: event.target.value }))}
                        onPressEnter={() => {
                          const next = { ...query, pageNum: 1 };
                          setQuery(next);
                          loadList(next);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} xl={6}>
                    <Form.Item label="部门" style={{ width: '100%', marginBottom: 12 }}>
                      <TreeSelect
                        allowClear
                        style={{ width: '100%' }}
                        placeholder="请选择部门"
                        value={query.deptId || undefined}
                        treeData={toSelectTree(deptTree)}
                        treeDefaultExpandAll
                        onChange={(value) => setQuery((prev) => ({ ...prev, deptId: value as number | string, belongDeptId: '' }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} xl={6}>
                    <Form.Item label="状态" style={{ width: '100%', marginBottom: 12 }}>
                      <Select
                        allowClear
                        style={{ width: '100%' }}
                        placeholder="岗位状态"
                        value={query.status || undefined}
                        options={(dict.sys_normal_disable || []).map((item) => ({ label: item.label, value: item.value }))}
                        onChange={(value) => setQuery((prev) => ({ ...prev, status: value || '' }))}
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
                {auth.hasPermiOr(['system:post:add']) && (
                  <Button
                    className="btn-plain-primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      form.setFieldsValue(initialForm);
                      setDialogOpen(true);
                    }}
                  >
                    新增
                  </Button>
                )}
                {auth.hasPermiOr(['system:post:edit']) && (
                  <Button
                    className="btn-plain-success"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(selectedIds[0])}
                    disabled={selectedIds.length !== 1}
                  >
                    修改
                  </Button>
                )}
                {auth.hasPermiOr(['system:post:remove']) && (
                  <Button className="btn-plain-danger" icon={<DeleteOutlined />} onClick={() => handleDelete()} disabled={selectedIds.length === 0}>
                    删除
                  </Button>
                )}
                {auth.hasPermiOr(['system:post:export']) && (
                  <Button
                    className="btn-plain-warning"
                    icon={<DownloadOutlined />}
                    onClick={() => download('/system/post/export', { ...query }, `post_${Date.now()}.xlsx`)}
                  >
                    导出
                  </Button>
                )}
              </Space>
              <div className="right-toolbar-wrap">
                <RightToolbar showSearch={showSearch} onShowSearchChange={setShowSearch} onQueryTable={() => loadList(query)} />
              </div>
            </div>

            <Table<PostVO>
              rowKey="postId"
              loading={loading}
              bordered
              columns={columns}
              dataSource={list}
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
          </Card>
        </Space>
      </Col>

      <CrudModal
        open={dialogOpen}
        title={postId ? '修改岗位' : '新增岗位'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Form.Item name="postId" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="岗位名称" name="postName" rules={[{ required: true, message: '岗位名称不能为空' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="部门" name="deptId" rules={[{ required: true, message: '部门不能为空' }]}>
            <TreeSelect treeData={toSelectTree(deptTree)} placeholder="请选择部门" allowClear treeDefaultExpandAll />
          </Form.Item>
          <Form.Item label="岗位编码" name="postCode" rules={[{ required: true, message: '岗位编码不能为空' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="类别编码" name="postCategory">
            <Input />
          </Form.Item>
          <Form.Item label="岗位顺序" name="postSort" rules={[{ required: true, message: '岗位顺序不能为空' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="岗位状态" name="status">
            <Radio.Group options={(dict.sys_normal_disable || []).map((item) => ({ label: item.label, value: item.value }))} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </CrudModal>
    </Row>
  );
}
