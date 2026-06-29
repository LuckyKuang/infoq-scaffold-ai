import { useCallback, useEffect, useState } from 'react';
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Radio, Row, Select, Space, Switch, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import useDictOptions from '@/hooks/useDictOptions';
import { addClient, changeStatus, delClient, getClient, listClient, updateClient } from '@/api/system/client';
import type { ClientForm, ClientQuery, ClientVO } from '@/api/system/client/types';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import DictTag from '@/components/DictTag';
import modal from '@/utils/modal';
import auth from '@/utils/permission';
import { download } from '@/utils/request';

const initialQuery: ClientQuery = {
  pageNum: 1,
  pageSize: 10,
  clientId: undefined,
  clientKey: '',
  clientSecret: '',
  grantType: undefined,
  deviceType: undefined,
  activeTimeout: undefined,
  timeout: undefined,
  status: ''
};

const initialForm: ClientForm = {
  id: undefined,
  clientId: undefined,
  clientKey: '',
  clientSecret: '',
  grantTypeList: [],
  deviceType: undefined,
  activeTimeout: 1800,
  timeout: 604800,
  status: '0'
};

export default function ClientPage() {
  const [query, setQuery] = useState<ClientQuery>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<ClientVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<ClientForm>();
  const editingClientId = Form.useWatch('id', form);
  const dict = useDictOptions('sys_normal_disable', 'sys_grant_type', 'sys_device_type');

  const loadList = useCallback(async (nextQuery: ClientQuery) => {
    setLoading(true);
    try {
      const response = await listClient(nextQuery);
      setList(response.rows);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList(initialQuery);
  }, [loadList]);

  const handleStatusToggle = async (record: ClientVO, checked: boolean) => {
    const nextStatus = checked ? '0' : '1';
    const label = nextStatus === '0' ? '启用' : '停用';
    const confirmed = await modal.confirm(`确认要${label}当前客户端吗？`);
    if (!confirmed) {
      return;
    }
    await changeStatus(record.clientId, nextStatus);
    modal.msgSuccess(`${label}成功`);
    loadList(query);
  };

  const columns: ColumnsType<ClientVO> = [
    {
      title: 'id',
      dataIndex: 'id',
      align: 'center'
    },
    {
      title: '客户端id',
      dataIndex: 'clientId',
      align: 'center'
    },
    {
      title: '客户端key',
      dataIndex: 'clientKey',
      align: 'center'
    },
    {
      title: '客户端秘钥',
      dataIndex: 'clientSecret',
      align: 'center'
    },
    {
      title: '授权类型',
      dataIndex: 'grantTypeList',
      align: 'center',
      render: (value: string[]) => <DictTag options={dict.sys_grant_type || []} value={value || []} />
    },
    {
      title: '设备类型',
      dataIndex: 'deviceType',
      align: 'center',
      render: (value: string) => <DictTag options={dict.sys_device_type || []} value={value} />
    },
    {
      title: 'Token活跃超时时间',
      dataIndex: 'activeTimeout',
      align: 'center'
    },
    {
      title: 'Token固定超时时间',
      dataIndex: 'timeout',
      align: 'center'
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      render: (value: string, record) => <Switch checked={value === '0'} onChange={(checked) => handleStatusToggle(record, checked)} />
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          {auth.hasPermiOr(['system:client:edit']) && (
            <Tooltip title="修改">
              <Button className="table-action-link" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record.id)} />
            </Tooltip>
          )}
          {auth.hasPermiOr(['system:client:remove']) && (
            <Tooltip title="删除">
              <Button className="table-action-link" type="link" icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const handleSearch = () => {
    const next = { ...query, pageNum: 1 };
    setQuery(next);
    loadList(next);
  };

  const handleReset = () => {
    setQuery(initialQuery);
    loadList(initialQuery);
  };

  const handleAdd = () => {
    form.setFieldsValue(initialForm);
    setDialogOpen(true);
  };

  const handleEdit = async (id?: string | number) => {
    if (!id) {
      return;
    }
    const response = await getClient(id);
    form.setFieldsValue({ ...initialForm, ...response.data });
    setDialogOpen(true);
  };

  const handleDelete = async (id?: string | number | Array<string | number>) => {
    const target = id || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的客户端');
      return;
    }
    const confirmed = await modal.confirm(`是否确认删除客户端编号为 "${Array.isArray(target) ? target.join(',') : target}" 的数据项？`);
    if (!confirmed) {
      return;
    }
    await delClient(target);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList(query);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.id) {
        await updateClient(values);
      } else {
        await addClient(values);
      }
      modal.msgSuccess('操作成功');
      setDialogOpen(false);
      loadList(query);
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
                <Form.Item label="客户端key" style={{ width: '100%', marginBottom: 12 }}>
                  <Input
                    allowClear
                    placeholder="请输入客户端key"
                    value={query.clientKey}
                    onChange={(event) => setQuery((prev) => ({ ...prev, clientKey: event.target.value }))}
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="客户端秘钥" style={{ width: '100%', marginBottom: 12 }}>
                  <Input
                    allowClear
                    placeholder="请输入客户端秘钥"
                    value={query.clientSecret}
                    onChange={(event) => setQuery((prev) => ({ ...prev, clientSecret: event.target.value }))}
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="状态" style={{ width: '100%', marginBottom: 12 }}>
                  <Select
                    allowClear
                    placeholder="状态"
                    style={{ width: '100%' }}
                    value={query.status || undefined}
                    options={(dict.sys_normal_disable || []).map((item) => ({ label: item.label, value: item.value }))}
                    onChange={(value) => setQuery((prev) => ({ ...prev, status: value || '' }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Space>
                    <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                      搜索
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={handleReset}>
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
            {auth.hasPermiOr(['system:client:add']) && (
              <Button className="btn-plain-primary" icon={<PlusOutlined />} onClick={handleAdd}>
                新增
              </Button>
            )}
            {auth.hasPermiOr(['system:client:edit']) && (
              <Button
                className="btn-plain-success"
                icon={<EditOutlined />}
                onClick={() => handleEdit(selectedIds[0])}
                disabled={selectedIds.length !== 1}
              >
                修改
              </Button>
            )}
            {auth.hasPermiOr(['system:client:remove']) && (
              <Button className="btn-plain-danger" icon={<DeleteOutlined />} onClick={() => handleDelete()} disabled={selectedIds.length === 0}>
                删除
              </Button>
            )}
            {auth.hasPermiOr(['system:client:export']) && (
              <Button
                className="btn-plain-warning"
                icon={<DownloadOutlined />}
                onClick={() => download('/system/client/export', { ...query }, `client_${Date.now()}.xlsx`)}
              >
                导出
              </Button>
            )}
          </Space>
          <div className="right-toolbar-wrap">
            <RightToolbar showSearch={showSearch} onShowSearchChange={setShowSearch} onQueryTable={() => loadList(query)} />
          </div>
        </div>

        <Table<ClientVO>
          rowKey="id"
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

      <Modal
        open={dialogOpen}
        title={editingClientId ? '修改客户端管理' : '新增客户端管理'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Form.Item label="客户端Key" name="clientKey" rules={[{ required: true, message: '客户端Key不能为空' }]}>
            <Input disabled={Boolean(editingClientId)} />
          </Form.Item>
          <Form.Item label="客户端秘钥" name="clientSecret" rules={[{ required: true, message: '客户端秘钥不能为空' }]}>
            <Input disabled={Boolean(editingClientId)} />
          </Form.Item>
          <Form.Item label="授权类型" name="grantTypeList" rules={[{ required: true, message: '授权类型不能为空' }]}>
            <Select mode="multiple" options={(dict.sys_grant_type || []).map((item) => ({ label: item.label, value: item.value }))} />
          </Form.Item>
          <Form.Item label="设备类型" name="deviceType" rules={[{ required: true, message: '设备类型不能为空' }]}>
            <Select options={(dict.sys_device_type || []).map((item) => ({ label: item.label, value: item.value }))} />
          </Form.Item>
          <Form.Item label="Token活跃超时时间" name="activeTimeout">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Token固定超时时间" name="timeout">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Radio.Group options={(dict.sys_normal_disable || []).map((item) => ({ label: item.label, value: item.value }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
