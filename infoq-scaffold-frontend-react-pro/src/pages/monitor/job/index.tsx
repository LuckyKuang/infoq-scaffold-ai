import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlayCircleOutlined,
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
  Switch,
  Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import {
  addJob,
  changeJobStatus,
  delJob,
  getJob,
  listJob,
  listJobHandlerKeys,
  runJob,
  updateJob,
} from '@/api/monitor/job';
import type { JobForm, JobQuery, JobVO } from '@/api/monitor/job/types';
import DictTag from '@/components/DictTag';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import useDictOptions from '@/hooks/useDictOptions';
import modal from '@/utils/modal';
import auth from '@/utils/permission';
import { download } from '@/utils/request';

const initialQuery: JobQuery = {
  pageNum: 1,
  pageSize: 10,
  jobName: '',
  jobGroup: '',
  handlerKey: '',
  status: '',
};

const initialForm: JobForm = {
  jobId: undefined,
  jobName: '',
  jobGroup: 'SYSTEM',
  handlerKey: '',
  handlerParams: '{}',
  cronExpression: '0 0/30 * * * ?',
  misfirePolicy: '0',
  concurrent: '1',
  status: '1',
  remark: '',
};

export default function JobPage() {
  const [query, setQuery] = useState<JobQuery>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<JobVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [handlerOptions, setHandlerOptions] = useState<string[]>([]);
  const [form] = Form.useForm<JobForm>();
  const editingJobId = Form.useWatch('jobId', form);
  const dict = useDictOptions(
    'sys_job_group',
    'sys_job_status',
    'sys_job_misfire_policy',
    'sys_job_concurrent',
  );

  const loadList = useCallback(async (nextQuery: JobQuery) => {
    setLoading(true);
    try {
      const response = await listJob(nextQuery);
      setList(response.rows);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHandlerOptions = useCallback(async () => {
    try {
      const response = await listJobHandlerKeys();
      if (!Array.isArray(response.data)) {
        throw new Error('任务处理器响应 data 必须是数组');
      }
      const nextOptions = response.data;
      setHandlerOptions(nextOptions);
      const currentKey = form.getFieldValue('handlerKey');
      if (!currentKey && nextOptions.length > 0) {
        form.setFieldValue('handlerKey', nextOptions[0]);
      }
    } catch (error) {
      modal.msgError(
        error instanceof Error ? error.message : '任务处理器加载失败',
      );
    }
  }, [form]);

  useEffect(() => {
    loadList(initialQuery);
    loadHandlerOptions();
  }, [loadList, loadHandlerOptions]);

  const handleStatusToggle = async (record: JobVO, checked: boolean) => {
    const nextStatus = checked ? '0' : '1';
    const label = nextStatus === '0' ? '启用' : '暂停';
    const confirmed = await modal.confirm(
      `确认要${label}任务 "${record.jobName}" 吗？`,
    );
    if (!confirmed) {
      return;
    }
    await changeJobStatus(record.jobId, nextStatus);
    modal.msgSuccess(`${label}成功`);
    loadList(query);
  };

  const columns: ColumnsType<JobVO> = [
    { title: '任务ID', dataIndex: 'jobId', align: 'center', width: 110 },
    { title: '任务名称', dataIndex: 'jobName', align: 'center' },
    {
      title: '任务分组',
      dataIndex: 'jobGroup',
      align: 'center',
      render: (value: string) => (
        <DictTag options={dict.sys_job_group || []} value={value} />
      ),
    },
    { title: '处理器', dataIndex: 'handlerKey', align: 'center' },
    { title: 'Cron表达式', dataIndex: 'cronExpression', align: 'center' },
    {
      title: '错过策略',
      dataIndex: 'misfirePolicy',
      align: 'center',
      render: (value: string) => (
        <DictTag options={dict.sys_job_misfire_policy || []} value={value} />
      ),
    },
    {
      title: '并发策略',
      dataIndex: 'concurrent',
      align: 'center',
      render: (value: string) => (
        <DictTag options={dict.sys_job_concurrent || []} value={value} />
      ),
    },
    {
      title: '任务状态',
      dataIndex: 'status',
      align: 'center',
      render: (value: string, record) => (
        <Switch
          checked={value === '0'}
          disabled={!auth.hasPermiOr(['monitor:job:changeStatus'])}
          onChange={(checked) => handleStatusToggle(record, checked)}
        />
      ),
    },
    { title: '备注', dataIndex: 'remark', align: 'center' },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          {auth.hasPermiOr(['monitor:job:run']) && (
            <Button
              className="table-action-link"
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleRun(record.jobId, record.jobName)}
            />
          )}
          {auth.hasPermiOr(['monitor:job:edit']) && (
            <Button
              className="table-action-link"
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.jobId)}
            />
          )}
          {auth.hasPermiOr(['monitor:job:remove']) && (
            <Button
              className="table-action-link"
              type="link"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.jobId)}
            />
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
    setQuery(initialQuery);
    loadList(initialQuery);
  };

  const handleAdd = () => {
    const nextForm = {
      ...initialForm,
      handlerKey: handlerOptions[0] || '',
    };
    form.setFieldsValue(nextForm);
    setDialogOpen(true);
  };

  const handleEdit = async (jobId?: string | number) => {
    if (!jobId) {
      return;
    }
    const response = await getJob(jobId);
    form.setFieldsValue({ ...initialForm, ...response.data });
    setDialogOpen(true);
  };

  const handleDelete = async (
    jobId?: string | number | Array<string | number>,
  ) => {
    const target = jobId || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的任务');
      return;
    }
    const display = Array.isArray(target) ? target.join(',') : target;
    const confirmed = await modal.confirm(
      `是否确认删除任务编号为 "${display}" 的数据项？`,
    );
    if (!confirmed) {
      return;
    }
    await delJob(target);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList(query);
  };

  const handleRun = async (jobId: string | number, jobName: string) => {
    const confirmed = await modal.confirm(
      `是否确认立即执行任务 "${jobName}" 一次？`,
    );
    if (!confirmed) {
      return;
    }
    await runJob(jobId);
    modal.msgSuccess('执行请求已提交');
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.jobId) {
        await updateJob(values);
      } else {
        await addJob(values);
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
                  label="任务名称"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入任务名称"
                    value={query.jobName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        jobName: event.target.value,
                      }))
                    }
                    onPressEnter={handleSearch}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="任务分组"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    allowClear
                    placeholder="任务分组"
                    style={{ width: '100%' }}
                    value={query.jobGroup || undefined}
                    options={(dict.sys_job_group || []).map((item) => ({
                      label: item.label,
                      value: item.value,
                    }))}
                    onChange={(value) =>
                      setQuery((prev) => ({ ...prev, jobGroup: value || '' }))
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="任务状态"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    allowClear
                    placeholder="任务状态"
                    style={{ width: '100%' }}
                    value={query.status || undefined}
                    options={(dict.sys_job_status || []).map((item) => ({
                      label: item.label,
                      value: item.value,
                    }))}
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
            {auth.hasPermiOr(['monitor:job:add']) && (
              <Button
                className="btn-plain-primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                新增
              </Button>
            )}
            {auth.hasPermiOr(['monitor:job:edit']) && (
              <Button
                className="btn-plain-success"
                icon={<EditOutlined />}
                onClick={() => handleEdit(selectedIds[0])}
                disabled={selectedIds.length !== 1}
              >
                修改
              </Button>
            )}
            {auth.hasPermiOr(['monitor:job:remove']) && (
              <Button
                className="btn-plain-danger"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete()}
                disabled={selectedIds.length === 0}
              >
                删除
              </Button>
            )}
            {auth.hasPermiOr(['monitor:job:export']) && (
              <Button
                className="btn-plain-warning"
                icon={<DownloadOutlined />}
                onClick={() =>
                  download(
                    '/monitor/job/export',
                    { ...query },
                    `job_${Date.now()}.xlsx`,
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
              onQueryTable={() => loadList(query)}
            />
          </div>
        </div>

        <Table<JobVO>
          rowKey="jobId"
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
        title={editingJobId ? '修改定时任务' : '新增定时任务'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Form.Item
            label="任务名称"
            name="jobName"
            rules={[{ required: true, message: '任务名称不能为空' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="任务分组"
            name="jobGroup"
            rules={[{ required: true, message: '任务分组不能为空' }]}
          >
            <Select
              options={(dict.sys_job_group || []).map((item) => ({
                label: item.label,
                value: item.value,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="处理器标识"
            name="handlerKey"
            rules={[{ required: true, message: '处理器标识不能为空' }]}
          >
            <Select
              options={handlerOptions.map((item) => ({
                label: item,
                value: item,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="处理器参数"
            name="handlerParams"
            rules={[{ required: true, message: '处理器参数不能为空' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            label="Cron表达式"
            name="cronExpression"
            rules={[{ required: true, message: 'Cron表达式不能为空' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="错过策略"
            name="misfirePolicy"
            rules={[{ required: true, message: '错过策略不能为空' }]}
          >
            <Radio.Group
              options={(dict.sys_job_misfire_policy || []).map((item) => ({
                label: item.label,
                value: item.value,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="并发策略"
            name="concurrent"
            rules={[{ required: true, message: '并发策略不能为空' }]}
          >
            <Radio.Group
              options={(dict.sys_job_concurrent || []).map((item) => ({
                label: item.label,
                value: item.value,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="任务状态"
            name="status"
            rules={[{ required: true, message: '任务状态不能为空' }]}
          >
            <Radio.Group
              options={(dict.sys_job_status || []).map((item) => ({
                label: item.label,
                value: item.value,
              }))}
            />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
