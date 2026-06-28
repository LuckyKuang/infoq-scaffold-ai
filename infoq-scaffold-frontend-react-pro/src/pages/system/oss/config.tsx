import {DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined,} from '@ant-design/icons';
import {Button, Card, Col, Form, Input, Modal, Radio, Row, Select, Space, Switch, Table, Tag, Tooltip,} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {useCallback, useState} from 'react';
import {
  addOssConfig,
  changeOssConfigStatus,
  delOssConfig,
  getOssConfig,
  listOssConfig,
  updateOssConfig,
} from '@/api/system/ossConfig';
import type {OssConfigForm, OssConfigQuery, OssConfigVO,} from '@/api/system/ossConfig/types';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import useInitialLoadEffect from '@/hooks/useInitialLoadEffect';
import useDictOptions from '@/hooks/useDictOptions';
import modal from '@/utils/modal';

const initialQuery: OssConfigQuery = {
  pageNum: 1,
  pageSize: 10,
  configKey: '',
  bucketName: '',
  status: '',
};

const initialForm: OssConfigForm = {
  ossConfigId: undefined,
  configKey: '',
  accessKey: '',
  secretKey: '',
  bucketName: '',
  prefix: '',
  endpoint: '',
  domain: '',
  isHttps: 'N',
  accessPolicy: '1',
  region: '',
  status: '1',
  remark: '',
};

export default function OssConfigPage() {
  const [query, setQuery] = useState<OssConfigQuery>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<OssConfigVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<OssConfigForm>();
  const editingConfigId = Form.useWatch('ossConfigId', form);
  const isHttps = Form.useWatch('isHttps', form) ?? initialForm.isHttps;
  const protocolPrefix = isHttps === 'Y' ? 'https://' : 'http://';
  const dict = useDictOptions('sys_yes_no');

  const loadList = useCallback(async (nextQuery: OssConfigQuery) => {
    setLoading(true);
    try {
      const response = await listOssConfig(nextQuery);
      setList(response.rows);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useInitialLoadEffect(() => {
    loadList(initialQuery);
  }, [loadList]);

  const columns: ColumnsType<OssConfigVO> = [
    {
      title: '配置Key',
      dataIndex: 'configKey',
      align: 'center',
    },
    {
      title: '访问站点',
      dataIndex: 'endpoint',
      width: 180,
      align: 'center',
    },
    {
      title: '自定义域名',
      dataIndex: 'domain',
      width: 180,
      align: 'center',
    },
    {
      title: '桶名称',
      dataIndex: 'bucketName',
      align: 'center',
    },
    {
      title: '前缀',
      dataIndex: 'prefix',
      width: 120,
      align: 'center',
    },
    {
      title: '域',
      dataIndex: 'region',
      width: 120,
      align: 'center',
    },
    {
      title: '桶权限',
      dataIndex: 'accessPolicy',
      width: 120,
      align: 'center',
      render: (value: string) =>
        value === '0' ? (
          <Tag color="warning">private</Tag>
        ) : value === '1' ? (
          <Tag color="success">public</Tag>
        ) : (
          <Tag>custom</Tag>
        ),
    },
    {
      title: '是否默认',
      dataIndex: 'status',
      width: 120,
      align: 'center',
      render: (value: string, record) => (
        <Switch
          checked={value === '0'}
          onChange={async (checked) => {
            const nextStatus = checked ? '0' : '1';
            const confirmed = await modal.confirm(
              `确认要${nextStatus === '0' ? '启用' : '停用'} "${record.configKey}" 配置吗？`,
            );
            if (!confirmed) {
              return;
            }
            await changeOssConfigStatus(
              record.ossConfigId,
              nextStatus,
              record.configKey,
            );
            modal.msgSuccess('状态修改成功');
            loadList(query);
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="修改">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.ossConfigId)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              danger
              type="link"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.ossConfigId)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleEdit = async (ossConfigId?: string | number) => {
    if (!ossConfigId) {
      return;
    }
    const response = await getOssConfig(ossConfigId);
    form.setFieldsValue({ ...initialForm, ...response.data });
    setDialogOpen(true);
  };

  const handleDelete = async (
    ossConfigId?: string | number | Array<string | number>,
  ) => {
    const target = ossConfigId || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的配置');
      return;
    }
    const confirmed = await modal.confirm(
      `是否确认删除OSS配置编号为 "${Array.isArray(target) ? target.join(',') : target}" 的数据项？`,
    );
    if (!confirmed) {
      return;
    }
    await delOssConfig(target);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList(query);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.ossConfigId) {
        await updateOssConfig(values);
      } else {
        await addOssConfig(values);
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
                <Form.Item
                  label="配置key"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="配置key"
                    value={query.configKey}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        configKey: event.target.value,
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
                  label="桶名称"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入桶名称"
                    value={query.bucketName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        bucketName: event.target.value,
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
                  label="是否默认"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="请选择状态"
                    value={query.status || undefined}
                    options={[
                      { label: '是', value: '0' },
                      { label: '否', value: '1' },
                    ]}
                    onChange={(value) =>
                      setQuery((prev) => ({ ...prev, status: value || '' }))
                    }
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
              onClick={() => {
                form.setFieldsValue(initialForm);
                setDialogOpen(true);
              }}
            >
              新增
            </Button>
            <Button
              icon={<EditOutlined />}
              style={{ color: '#67c23a', borderColor: '#b7eb8f' }}
              onClick={() => handleEdit(selectedIds[0])}
              disabled={selectedIds.length !== 1}
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
          </Space>
          <RightToolbar
            showSearch={showSearch}
            onShowSearchChange={setShowSearch}
            onQueryTable={() => loadList(query)}
          />
        </div>

        <Table<OssConfigVO>
          rowKey="ossConfigId"
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

      <Modal
        width={860}
        open={dialogOpen}
        title={editingConfigId ? '修改对象存储配置' : '新增对象存储配置'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Form.Item
            label="配置Key"
            name="configKey"
            rules={[{ required: true, message: '配置Key不能为空' }]}
          >
            <Input />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item style={{ flex: 1 }} label="访问站点" required>
              <Space.Compact style={{ width: '100%' }}>
                <Input value={protocolPrefix} disabled style={{ width: 110 }} />
                <Form.Item
                  name="endpoint"
                  noStyle
                  rules={[{ required: true, message: '访问站点不能为空' }]}
                >
                  <Input />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item style={{ flex: 1 }} label="自定义域名">
              <Space.Compact style={{ width: '100%' }}>
                <Input value={protocolPrefix} disabled style={{ width: 110 }} />
                <Form.Item name="domain" noStyle>
                  <Input />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
          </Space>
          <Form.Item
            label="AccessKey"
            name="accessKey"
            rules={[{ required: true, message: 'AccessKey不能为空' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="SecretKey"
            name="secretKey"
            rules={[{ required: true, message: 'SecretKey不能为空' }]}
          >
            <Input.Password />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item
              style={{ flex: 1 }}
              label="桶名称"
              name="bucketName"
              rules={[{ required: true, message: '桶名称不能为空' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item style={{ flex: 1 }} label="前缀" name="prefix">
              <Input />
            </Form.Item>
          </Space>
          <Form.Item label="是否HTTPS" name="isHttps">
            <Radio.Group
              options={(dict.sys_yes_no || []).map((item) => ({
                label: item.label,
                value: item.value,
              }))}
            />
          </Form.Item>
          <Form.Item label="桶权限类型" name="accessPolicy">
            <Radio.Group
              options={[
                { label: 'private', value: '0' },
                { label: 'public', value: '1' },
                { label: 'custom', value: '2' },
              ]}
            />
          </Form.Item>
          <Form.Item label="域" name="region">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
