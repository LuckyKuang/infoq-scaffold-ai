import {
  CloseCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import type {Dayjs} from 'dayjs';
import {useCallback, useState} from 'react';
import {cancelInvite, delInvite, generateInvite, listInvite,} from '@/api/system/invite';
import type {InviteCodeGenerateForm, InviteCodeQuery, InviteCodeVO,} from '@/api/system/invite/types';
import CrudModal from '@/components/CrudModal';
import DictTag from '@/components/DictTag';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import useDictOptions from '@/hooks/useDictOptions';
import useInitialLoadEffect from '@/hooks/useInitialLoadEffect';
import modal from '@/utils/modal';
import auth from '@/utils/permission';
import {download} from '@/utils/request';
import {addDateRange} from '@/utils/scaffold';

type GenerateInviteFormState = InviteCodeGenerateForm & {
  expireTime?: Dayjs;
  permanent: boolean;
};

type CancelInviteFormState = {
  inviteId?: number | string;
  canceledReason: string;
};

const initialQuery: InviteCodeQuery = {
  pageNum: 1,
  pageSize: 10,
  inviteCode: '',
  status: '',
  usedUserEmail: '',
  creatorName: '',
};

const initialGenerateForm: GenerateInviteFormState = {
  generateCount: 1,
  expireTime: undefined,
  remark: '',
  permanent: true,
};

const initialCancelForm: CancelInviteFormState = {
  inviteId: undefined,
  canceledReason: '',
};

const formatRange = (range: [Dayjs, Dayjs] | null) =>
  range
    ? [
        range[0].format('YYYY-MM-DD HH:mm:ss'),
        range[1].format('YYYY-MM-DD HH:mm:ss'),
      ]
    : [];

export default function InvitePage() {
  const [query, setQuery] = useState<InviteCodeQuery>(initialQuery);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<InviteCodeVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [selectedRows, setSelectedRows] = useState<InviteCodeVO[]>([]);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generateForm] = Form.useForm<GenerateInviteFormState>();
  const [cancelForm] = Form.useForm<CancelInviteFormState>();
  const generatePermanent = Form.useWatch('permanent', generateForm) ?? true;
  const dict = useDictOptions('sys_invite_code_status');

  const loadList = useCallback(
    async (nextQuery: InviteCodeQuery, nextRange: [Dayjs, Dayjs] | null) => {
      setLoading(true);
      try {
        const response = await listInvite(
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
    { dedupeKey: 'system-invite-initial-list' },
  );

  const canCancel = (record: InviteCodeVO) => record.status === '0';
  const canDelete = (record: InviteCodeVO) => record.status !== '1';

  const columns: ColumnsType<InviteCodeVO> = [
    {
      title: '邀请码',
      dataIndex: 'inviteCode',
      width: 260,
      align: 'center',
      render: (value: string) => (
        <Typography.Text
          copyable={{
            text: value,
            onCopy: () => modal.msgSuccess('邀请码已复制'),
          }}
          style={{ fontFamily: 'Consolas, Monaco, monospace' }}
        >
          {value}
        </Typography.Text>
      ),
    },
    {
      title: '总状态',
      dataIndex: 'status',
      width: 120,
      align: 'center',
      render: (value: string) => (
        <DictTag options={dict.sys_invite_code_status || []} value={value} />
      ),
    },
    {
      title: '使用人邮箱',
      dataIndex: 'usedUserEmail',
      width: 180,
      align: 'center',
      ellipsis: true,
    },
    {
      title: '生成人',
      dataIndex: 'creatorName',
      width: 140,
      align: 'center',
      ellipsis: true,
    },
    {
      title: '生成时间',
      dataIndex: 'createTime',
      width: 180,
      align: 'center',
    },
    {
      title: '过期时间',
      dataIndex: 'expireTime',
      width: 180,
      align: 'center',
    },
    {
      title: '使用时间',
      dataIndex: 'usedTime',
      width: 180,
      align: 'center',
    },
    {
      title: '作废时间',
      dataIndex: 'canceledTime',
      width: 180,
      align: 'center',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '作废原因',
      dataIndex: 'canceledReason',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          {auth.hasPermiOr(['system:invite:edit']) && (
            <Tooltip title="作废">
              <Button
                className="table-action-link"
                type="link"
                icon={<CloseCircleOutlined />}
                disabled={!canCancel(record)}
                onClick={() => openCancelDialog(record)}
              />
            </Tooltip>
          )}
          {auth.hasPermiOr(['system:invite:remove']) && (
            <Tooltip title="删除">
              <Button
                className="table-action-link"
                type="link"
                icon={<DeleteOutlined />}
                disabled={!canDelete(record)}
                onClick={() => handleDelete(record)}
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

  const openGenerateDialog = () => {
    generateForm.setFieldsValue(initialGenerateForm);
    setGenerateDialogOpen(true);
  };

  const closeGenerateDialog = () => {
    setGenerateDialogOpen(false);
    generateForm.resetFields();
  };

  const resolveCancelRecord = (record?: InviteCodeVO) => {
    const target = record ?? selectedRows[0];
    if (!target) {
      modal.msgWarning('请选择需要作废的邀请码');
      return undefined;
    }
    if (!canCancel(target)) {
      modal.msgWarning('仅未使用的邀请码允许作废');
      return undefined;
    }
    return target;
  };

  const openCancelDialog = (record?: InviteCodeVO) => {
    const target = resolveCancelRecord(record);
    if (!target) {
      return;
    }
    cancelForm.setFieldsValue({
      ...initialCancelForm,
      inviteId: target.inviteId,
    });
    setCancelDialogOpen(true);
  };

  const closeCancelDialog = () => {
    setCancelDialogOpen(false);
    cancelForm.resetFields();
  };

  const handleGenerateSubmit = async () => {
    const values = await generateForm.validateFields();
    setSubmitting(true);
    try {
      await generateInvite({
        generateCount: values.generateCount,
        expireTime: values.permanent
          ? undefined
          : values.expireTime?.format('YYYY-MM-DD HH:mm:ss'),
        remark: values.remark,
      });
      modal.msgSuccess('生成成功');
      closeGenerateDialog();
      loadList(query, dateRange);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubmit = async () => {
    const values = await cancelForm.validateFields();
    if (!values.inviteId) {
      return;
    }
    setSubmitting(true);
    try {
      await cancelInvite({
        inviteId: values.inviteId,
        canceledReason: values.canceledReason,
      });
      modal.msgSuccess('作废成功');
      closeCancelDialog();
      loadList(query, dateRange);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record?: InviteCodeVO) => {
    const targets = record ? [record] : selectedRows;
    if (!targets.length) {
      modal.msgWarning('请选择需要删除的邀请码');
      return;
    }
    if (targets.some((item) => !canDelete(item))) {
      modal.msgWarning('已使用的邀请码不允许删除');
      return;
    }
    const confirmed = await modal.confirm(
      `是否确认删除邀请码 "${targets.map((item) => item.inviteCode).join('、')}" ?`,
    );
    if (!confirmed) {
      return;
    }
    await delInvite(record ? record.inviteId : selectedIds);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    setSelectedRows([]);
    loadList(query, dateRange);
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {showSearch && (
        <Card>
          <Form layout="inline" className="query-form">
            <Row gutter={16} style={{ width: '100%' }}>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="邀请码"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入邀请码"
                    value={query.inviteCode}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        inviteCode: event.target.value,
                      }))
                    }
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="总状态"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    allowClear
                    placeholder="请选择状态"
                    style={{ width: '100%' }}
                    value={query.status || undefined}
                    options={(dict.sys_invite_code_status || []).map(
                      (item) => ({ label: item.label, value: item.value }),
                    )}
                    onChange={(value) =>
                      setQuery((prev) => ({ ...prev, status: value || '' }))
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="使用人邮箱"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入使用人邮箱"
                    value={query.usedUserEmail}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        usedUserEmail: event.target.value,
                      }))
                    }
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="生成人"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入生成人"
                    value={query.creatorName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        creatorName: event.target.value,
                      }))
                    }
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={8}>
                <Form.Item
                  label="生成时间"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <DatePicker.RangePicker
                    showTime
                    placeholder={['开始时间', '结束时间']}
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
            {auth.hasPermiOr(['system:invite:add']) && (
              <Button
                className="btn-plain-primary"
                icon={<PlusOutlined />}
                onClick={openGenerateDialog}
              >
                生成邀请码
              </Button>
            )}
            {auth.hasPermiOr(['system:invite:edit']) && (
              <Button
                className="btn-plain-warning"
                icon={<CloseCircleOutlined />}
                onClick={() => openCancelDialog()}
                disabled={selectedRows.length !== 1}
              >
                作废
              </Button>
            )}
            {auth.hasPermiOr(['system:invite:remove']) && (
              <Button
                className="btn-plain-danger"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete()}
                disabled={selectedRows.length === 0}
              >
                删除
              </Button>
            )}
            {auth.hasPermiOr(['system:invite:export']) && (
              <Button
                className="btn-plain-warning"
                icon={<DownloadOutlined />}
                onClick={() =>
                  download(
                    '/system/invite/export',
                    addDateRange({ ...query }, formatRange(dateRange)),
                    `invite_${Date.now()}.xlsx`,
                  )
                }
              >
                导出
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

        <Table<InviteCodeVO>
          rowKey="inviteId"
          loading={loading}
          bordered
          columns={columns}
          dataSource={list}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys, rows) => {
              setSelectedIds(keys as Array<string | number>);
              setSelectedRows(rows);
            },
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
        open={generateDialogOpen}
        title="生成邀请码"
        confirmLoading={submitting}
        onCancel={closeGenerateDialog}
        onOk={handleGenerateSubmit}
      >
        <Form
          form={generateForm}
          layout="vertical"
          initialValues={initialGenerateForm}
        >
          <Form.Item
            label="生成数量"
            name="generateCount"
            rules={[{ required: true, message: '生成数量不能为空' }]}
          >
            <InputNumber
              min={1}
              max={100}
              precision={0}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="永久有效" name="permanent" valuePropName="checked">
            <Switch />
          </Form.Item>
          {!generatePermanent && (
            <Form.Item
              label="过期时间"
              name="expireTime"
              rules={[{ required: true, message: '请选择过期时间' }]}
            >
              <DatePicker
                showTime
                style={{ width: '100%' }}
                format="YYYY-MM-DD HH:mm:ss"
              />
            </Form.Item>
          )}
          <Form.Item label="备注" name="remark">
            <Input.TextArea
              rows={4}
              maxLength={255}
              showCount
              placeholder="请输入用途备注"
            />
          </Form.Item>
        </Form>
      </CrudModal>

      <CrudModal
        open={cancelDialogOpen}
        title="作废邀请码"
        confirmLoading={submitting}
        onCancel={closeCancelDialog}
        onOk={handleCancelSubmit}
      >
        <Form
          form={cancelForm}
          layout="vertical"
          initialValues={initialCancelForm}
        >
          <Form.Item name="inviteId" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            label="作废原因"
            name="canceledReason"
            rules={[{ required: true, message: '作废原因不能为空' }]}
          >
            <Input.TextArea
              rows={4}
              maxLength={255}
              showCount
              placeholder="请输入作废原因"
            />
          </Form.Item>
        </Form>
      </CrudModal>
    </Space>
  );
}
