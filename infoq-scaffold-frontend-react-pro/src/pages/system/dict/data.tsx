import {
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tooltip,} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {useCallback, useEffect, useState} from 'react';
import {useLocation, useNavigate} from '@umijs/max';
import {addData, delData, getData, listData, updateData,} from '@/api/system/dict/data';
import type {DictDataForm, DictDataQuery, DictDataVO,} from '@/api/system/dict/data/types';
import {getType, optionselect as getDictTypeOptions,} from '@/api/system/dict/type';
import type {DictTypeVO} from '@/api/system/dict/type/types';
import DictTag from '@/components/DictTag';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import modal from '@/utils/modal';
import auth from '@/utils/permission';
import {download} from '@/utils/request';

const initialQuery: DictDataQuery = {
  pageNum: 1,
  pageSize: 10,
  dictName: '',
  dictType: '',
  dictLabel: '',
};

const initialForm: DictDataForm = {
  dictType: '',
  dictCode: undefined,
  dictLabel: '',
  dictValue: '',
  cssClass: '',
  listClass: 'primary',
  dictSort: 0,
  remark: '',
};

const listClassOptions: Array<{ label: string; value: ElTagType | 'default' }> =
  [
    { label: '默认', value: 'default' },
    { label: '主要', value: 'primary' },
    { label: '成功', value: 'success' },
    { label: '信息', value: 'info' },
    { label: '警告', value: 'warning' },
    { label: '危险', value: 'danger' },
  ];

export default function DictDataPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dictId = location.pathname.split('/').pop();
  const [query, setQuery] = useState<DictDataQuery>(initialQuery);
  const [defaultDictType, setDefaultDictType] = useState('');
  const [typeOptions, setTypeOptions] = useState<DictTypeVO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<DictDataVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<DictDataForm>();
  const dictCode = Form.useWatch('dictCode', form);

  const loadTypeOptions = useCallback(async () => {
    const response = await getDictTypeOptions();
    setTypeOptions(response.data);
  }, []);

  const loadList = useCallback(async (nextQuery: DictDataQuery) => {
    setLoading(true);
    try {
      const response = await listData(nextQuery);
      setList(response.rows);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCurrentType = useCallback(
    async (baseQuery: DictDataQuery) => {
      if (!dictId) {
        return;
      }
      const response = await getType(dictId);
      const info = response.data;
      if (!info) {
        return;
      }
      const nextQuery = {
        ...baseQuery,
        dictType: info.dictType,
      };
      setDefaultDictType(info.dictType);
      setQuery(nextQuery);
      loadList(nextQuery);
    },
    [dictId, loadList],
  );

  useEffect(() => {
    loadTypeOptions();
    loadCurrentType(initialQuery);
  }, [loadCurrentType, loadTypeOptions]);

  const columns: ColumnsType<DictDataVO> = [
    {
      title: '字典标签',
      dataIndex: 'dictLabel',
      align: 'center',
      render: (_value: string, record) => (
        <DictTag
          options={[
            {
              label: record.dictLabel,
              value: record.dictValue,
              elTagType: record.listClass || undefined,
              elTagClass: record.cssClass || undefined,
            },
          ]}
          value={record.dictValue}
        />
      ),
    },
    {
      title: '字典键值',
      dataIndex: 'dictValue',
      align: 'center',
    },
    {
      title: '字典排序',
      dataIndex: 'dictSort',
      width: 120,
      align: 'center',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      align: 'center',
      ellipsis: true,
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
      width: 160,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          {auth.hasPermiOr(['system:dict:edit']) && (
            <Tooltip title="修改">
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record.dictCode)}
              />
            </Tooltip>
          )}
          {auth.hasPermiOr(['system:dict:remove']) && (
            <Tooltip title="删除">
              <Button
                danger
                type="link"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.dictCode)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const handleSearch = () => {
    const next = { ...query, pageNum: 1 };
    setQuery(next);
    loadList(next);
  };

  const handleReset = () => {
    const next = {
      ...query,
      pageNum: 1,
      dictLabel: '',
      dictType: defaultDictType,
    };
    setQuery(next);
    loadList(next);
  };

  const handleAdd = () => {
    form.setFieldsValue({
      ...initialForm,
      dictType: query.dictType,
    });
    setDialogOpen(true);
  };

  const handleEdit = async (dictCode?: string | number) => {
    if (!dictCode) {
      return;
    }
    const response = await getData(dictCode);
    form.setFieldsValue({ ...initialForm, ...response.data });
    setDialogOpen(true);
  };

  const handleDelete = async (
    dictCode?: string | number | Array<string | number>,
  ) => {
    const target = dictCode || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的字典数据');
      return;
    }
    const confirmed = await modal.confirm(
      `是否确认删除字典编码为 "${Array.isArray(target) ? target.join(',') : target}" 的数据项？`,
    );
    if (!confirmed) {
      return;
    }
    await delData(target);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList(query);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.dictCode) {
        await updateData(values);
      } else {
        await addData(values);
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
                  label="字典名称"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    style={{ width: '100%' }}
                    value={query.dictType}
                    options={typeOptions.map((item) => ({
                      label: item.dictName,
                      value: item.dictType,
                    }))}
                    onChange={(value) =>
                      setQuery((prev) => ({ ...prev, dictType: value || '' }))
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="字典标签"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入字典标签"
                    value={query.dictLabel}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        dictLabel: event.target.value,
                      }))
                    }
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Space>
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={handleSearch}
                    >
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
            {auth.hasPermiOr(['system:dict:add']) && (
              <Button
                className="btn-plain-primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                新增
              </Button>
            )}
            {auth.hasPermiOr(['system:dict:edit']) && (
              <Button
                icon={<EditOutlined />}
                style={{ color: '#67c23a', borderColor: '#b7eb8f' }}
                onClick={() => handleEdit(selectedIds[0])}
                disabled={selectedIds.length !== 1}
              >
                修改
              </Button>
            )}
            {auth.hasPermiOr(['system:dict:remove']) && (
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete()}
                disabled={selectedIds.length === 0}
                style={{ borderColor: '#ffccc7' }}
              >
                删除
              </Button>
            )}
            {auth.hasPermiOr(['system:dict:export']) && (
              <Button
                icon={<DownloadOutlined />}
                style={{ color: '#e6a23c', borderColor: '#ffd591' }}
                onClick={() =>
                  download(
                    '/system/dict/data/export',
                    { ...query },
                    `dict_data_${Date.now()}.xlsx`,
                  )
                }
              >
                导出
              </Button>
            )}
            <Button
              icon={<CloseOutlined />}
              style={{ color: '#e6a23c', borderColor: '#ffd591' }}
              onClick={() => navigate('/system/dict')}
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

        <Table<DictDataVO>
          rowKey="dictCode"
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
        open={dialogOpen}
        title={dictCode ? '修改字典数据' : '新增字典数据'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Form.Item label="字典类型" name="dictType">
            <Input disabled />
          </Form.Item>
          <Form.Item
            label="数据标签"
            name="dictLabel"
            rules={[{ required: true, message: '数据标签不能为空' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="数据键值"
            name="dictValue"
            rules={[{ required: true, message: '数据键值不能为空' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="样式属性" name="cssClass">
            <Input />
          </Form.Item>
          <Form.Item
            label="显示排序"
            name="dictSort"
            rules={[{ required: true, message: '字典排序不能为空' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="回显样式" name="listClass">
            <Select
              options={listClassOptions.map((item) => ({
                label: `${item.label}(${item.value})`,
                value: item.value,
              }))}
            />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
