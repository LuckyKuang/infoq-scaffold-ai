import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {useNavigate} from '@umijs/max';
import {Button, Card, Col, DatePicker, Form, Input, Row, Space, Table, Tooltip,} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import type {Dayjs} from 'dayjs';
import {useCallback, useState} from 'react';
import {addType, delType, getType, listType, refreshCache, updateType,} from '@/api/system/dict/type';
import type {DictTypeForm, DictTypeQuery, DictTypeVO,} from '@/api/system/dict/type/types';
import CrudModal from '@/components/CrudModal';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import useInitialLoadEffect from '@/hooks/useInitialLoadEffect';
import modal from '@/utils/modal';
import auth from '@/utils/permission';
import {download} from '@/utils/request';
import {addDateRange} from '@/utils/scaffold';

const initialQuery: DictTypeQuery = {
  pageNum: 1,
  pageSize: 10,
  dictName: '',
  dictType: '',
};

const initialForm: DictTypeForm = {
  dictId: undefined,
  dictName: '',
  dictType: '',
  remark: '',
};

const formatRange = (range: [Dayjs, Dayjs] | null) =>
  range
    ? [
        range[0].format('YYYY-MM-DD HH:mm:ss'),
        range[1].format('YYYY-MM-DD HH:mm:ss'),
      ]
    : [];

export default function DictTypePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState<DictTypeQuery>(initialQuery);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<DictTypeVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<DictTypeForm>();
  const dictId = Form.useWatch('dictId', form);

  const loadList = useCallback(
    async (nextQuery: DictTypeQuery, nextRange: [Dayjs, Dayjs] | null) => {
      setLoading(true);
      try {
        const response = await listType(
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

  useInitialLoadEffect(
    () => {
      loadList(initialQuery, null);
    },
    [loadList],
    { dedupeKey: 'system-dict-initial-list' },
  );

  const columns: ColumnsType<DictTypeVO> = [
    {
      title: '字典名称',
      dataIndex: 'dictName',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '字典类型',
      dataIndex: 'dictType',
      align: 'center',
      ellipsis: true,
      render: (_value: string, record) => (
        <Button
          type="link"
          onClick={() => navigate(`/system/dict-data/index/${record.dictId}`)}
        >
          {record.dictType}
        </Button>
      ),
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
                className="table-action-link"
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record.dictId)}
              />
            </Tooltip>
          )}
          {auth.hasPermiOr(['system:dict:remove']) && (
            <Tooltip title="删除">
              <Button
                className="table-action-link"
                type="link"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.dictId)}
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
    loadList(next, dateRange);
  };

  const handleReset = () => {
    setQuery(initialQuery);
    setDateRange(null);
    loadList(initialQuery, null);
  };

  const handleAdd = () => {
    form.setFieldsValue(initialForm);
    setDialogOpen(true);
  };

  const handleEdit = async (dictId?: string | number) => {
    if (!dictId) {
      return;
    }
    const response = await getType(dictId);
    form.setFieldsValue({ ...initialForm, ...response.data });
    setDialogOpen(true);
  };

  const handleDelete = async (
    dictId?: string | number | Array<string | number>,
  ) => {
    const target = dictId || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的字典类型');
      return;
    }
    const confirmed = await modal.confirm(
      `是否确认删除字典编号为 "${Array.isArray(target) ? target.join(',') : target}" 的数据项？`,
    );
    if (!confirmed) {
      return;
    }
    await delType(target);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList(query, dateRange);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.dictId) {
        await updateType(values);
      } else {
        await addType(values);
      }
      modal.msgSuccess('操作成功');
      setDialogOpen(false);
      loadList(query, dateRange);
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
                  <Input
                    allowClear
                    placeholder="请输入字典名称"
                    value={query.dictName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        dictName: event.target.value,
                      }))
                    }
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="字典类型"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入字典类型"
                    value={query.dictType}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        dictType: event.target.value,
                      }))
                    }
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="创建时间"
                  style={{ width: '100%', marginBottom: 12 }}
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
        <div className="table-toolbar">
          <Space wrap className="toolbar-buttons">
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
                className="btn-plain-success"
                icon={<EditOutlined />}
                onClick={() => handleEdit(selectedIds[0])}
                disabled={selectedIds.length !== 1}
              >
                修改
              </Button>
            )}
            {auth.hasPermiOr(['system:dict:remove']) && (
              <Button
                className="btn-plain-danger"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete()}
                disabled={selectedIds.length === 0}
              >
                删除
              </Button>
            )}
            {auth.hasPermiOr(['system:dict:export']) && (
              <Button
                className="btn-plain-warning"
                icon={<DownloadOutlined />}
                onClick={() =>
                  download(
                    '/system/dict/type/export',
                    addDateRange({ ...query }, formatRange(dateRange)),
                    `dict_${Date.now()}.xlsx`,
                  )
                }
              >
                导出
              </Button>
            )}
            {auth.hasPermiOr(['system:dict:remove']) && (
              <Button
                className="btn-plain-danger"
                icon={<ReloadOutlined />}
                onClick={async () => {
                  await refreshCache();
                  modal.msgSuccess('刷新成功');
                }}
              >
                刷新缓存
              </Button>
            )}
          </Space>
          <div className="right-toolbar-wrap">
            <RightToolbar
              showSearch={showSearch}
              onShowSearchChange={setShowSearch}
              onQueryTable={() => loadList(query, dateRange)}
            />
          </div>
        </div>

        <Table<DictTypeVO>
          rowKey="dictId"
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
            loadList(next, dateRange);
          }}
        />
      </Card>

      <CrudModal
        open={dialogOpen}
        title={dictId ? '修改字典类型' : '新增字典类型'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Form.Item
            label="字典名称"
            name="dictName"
            rules={[{ required: true, message: '字典名称不能为空' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="字典类型"
            name="dictType"
            rules={[{ required: true, message: '字典类型不能为空' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </CrudModal>
    </Space>
  );
}
