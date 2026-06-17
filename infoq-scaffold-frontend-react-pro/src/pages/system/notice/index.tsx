import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import {
  addNotice,
  delNotice,
  getNotice,
  listNotice,
  updateNotice,
} from '@/api/system/notice';
import type {
  NoticeForm,
  NoticeQuery,
  NoticeVO,
} from '@/api/system/notice/types';
import DictTag from '@/components/DictTag';
import Editor from '@/components/Editor';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import useDictOptions from '@/hooks/useDictOptions';
import modal from '@/utils/modal';

const initialQuery: NoticeQuery = {
  pageNum: 1,
  pageSize: 10,
  noticeTitle: '',
  createByName: '',
  status: '',
  noticeType: '',
};

const initialForm: NoticeForm = {
  noticeId: undefined,
  noticeTitle: '',
  noticeType: '',
  noticeContent: '',
  status: '0',
  remark: '',
  createByName: '',
};

export default function NoticePage() {
  const [query, setQuery] = useState<NoticeQuery>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<NoticeVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<NoticeForm>();
  const noticeId = Form.useWatch('noticeId', form);
  const dict = useDictOptions('sys_notice_status', 'sys_notice_type');

  const loadList = useCallback(async (nextQuery: NoticeQuery) => {
    setLoading(true);
    try {
      const response = await listNotice(nextQuery);
      setList(response.rows);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList(initialQuery);
  }, [loadList]);

  const columns: ColumnsType<NoticeVO> = [
    {
      title: '公告标题',
      dataIndex: 'noticeTitle',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '公告类型',
      dataIndex: 'noticeType',
      width: 120,
      align: 'center',
      render: (value: string) => (
        <DictTag options={dict.sys_notice_type || []} value={value} />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      align: 'center',
      render: (value: string) => (
        <DictTag options={dict.sys_notice_status || []} value={value} />
      ),
    },
    {
      title: '创建者',
      dataIndex: 'createByName',
      width: 120,
      align: 'center',
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 120,
      align: 'center',
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
              className="table-action-link"
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.noticeId)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              className="table-action-link"
              type="link"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.noticeId)}
            />
          </Tooltip>
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
    setQuery(initialQuery);
    loadList(initialQuery);
  };

  const handleAdd = () => {
    form.setFieldsValue(initialForm);
    setDialogOpen(true);
  };

  const handleEdit = async (noticeId: string | number) => {
    const response = await getNotice(noticeId);
    form.setFieldsValue({ ...initialForm, ...response.data });
    setDialogOpen(true);
  };

  const handleDelete = async (
    noticeId?: string | number | Array<string | number>,
  ) => {
    const target = noticeId || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的公告');
      return;
    }
    const confirmed = await modal.confirm(
      `是否确认删除公告编号为 "${Array.isArray(target) ? target.join(',') : target}" 的数据项？`,
    );
    if (!confirmed) {
      return;
    }
    await delNotice(target);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList(query);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.noticeId) {
        await updateNotice(values);
      } else {
        await addNotice(values);
      }
      modal.msgSuccess('操作成功');
      setDialogOpen(false);
      form.resetFields();
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
                  label="公告标题"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入公告标题"
                    value={query.noticeTitle}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        noticeTitle: event.target.value,
                      }))
                    }
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="操作人员"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入操作人员"
                    value={query.createByName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        createByName: event.target.value,
                      }))
                    }
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="类型"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    allowClear
                    placeholder="公告类型"
                    style={{ width: '100%' }}
                    value={query.noticeType || undefined}
                    options={(dict.sys_notice_type || []).map((item) => ({
                      label: item.label,
                      value: item.value,
                    }))}
                    onChange={(value) =>
                      setQuery((prev) => ({ ...prev, noticeType: value || '' }))
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
            <Button
              className="btn-plain-primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增
            </Button>
            <Button
              className="btn-plain-success"
              icon={<EditOutlined />}
              onClick={() => handleEdit(selectedIds[0])}
              disabled={selectedIds.length !== 1}
            >
              修改
            </Button>
            <Button
              className="btn-plain-danger"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete()}
              disabled={selectedIds.length === 0}
            >
              删除
            </Button>
          </Space>
          <div className="right-toolbar-wrap">
            <RightToolbar
              showSearch={showSearch}
              onShowSearchChange={setShowSearch}
              onQueryTable={() => loadList(query)}
            />
          </div>
        </div>

        <Table<NoticeVO>
          rowKey="noticeId"
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
        width={880}
        open={dialogOpen}
        title={noticeId ? '修改公告' : '新增公告'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="公告标题"
                name="noticeTitle"
                rules={[{ required: true, message: '公告标题不能为空' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="公告类型"
                name="noticeType"
                rules={[{ required: true, message: '公告类型不能为空' }]}
              >
                <Select
                  options={(dict.sys_notice_type || []).map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="状态" name="status">
                <Radio.Group
                  options={(dict.sys_notice_status || []).map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="内容" name="noticeContent">
                <Editor minHeight={192} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
}
