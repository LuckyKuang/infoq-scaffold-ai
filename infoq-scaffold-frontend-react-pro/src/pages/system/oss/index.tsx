import {
  DeleteOutlined,
  DownloadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {Button, Card, Col, DatePicker, Form, Image, Input, Modal, Row, Space, Table, Tooltip,} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import type {Dayjs} from 'dayjs';
import {useCallback, useState} from 'react';
import {useNavigate} from '@umijs/max';
import {getConfigKey, updateConfigByKey} from '@/api/system/config';
import {delOss, listOss} from '@/api/system/oss';
import type {OssForm, OssQuery, OssVO} from '@/api/system/oss/types';
import FileUpload from '@/components/FileUpload';
import ImageUpload from '@/components/ImageUpload';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import useInitialLoadEffect from '@/hooks/useInitialLoadEffect';
import modal from '@/utils/modal';
import {addDateRange} from '@/utils/scaffold';

const initialQuery: OssQuery = {
  pageNum: 1,
  pageSize: 10,
  fileName: '',
  originalName: '',
  fileSuffix: '',
  createTime: '',
  service: '',
  orderByColumn: 'createTime',
  isAsc: 'ascending',
};

const formatRange = (range: [Dayjs, Dayjs] | null) =>
  range
    ? [
        range[0].format('YYYY-MM-DD HH:mm:ss'),
        range[1].format('YYYY-MM-DD HH:mm:ss'),
      ]
    : [];

const isImage = (suffix?: string) =>
  ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(
    (suffix || '').toLowerCase(),
  );

export default function OssPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState<OssQuery>(initialQuery);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewListResource, setPreviewListResource] = useState(true);
  const [list, setList] = useState<OssVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'image'>('file');
  const [form] = Form.useForm<OssForm>();

  const loadPreviewSetting = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const response = await getConfigKey('sys.oss.previewListResource');
      setPreviewListResource(
        response.data === undefined ? true : response.data === 'true',
      );
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const loadList = useCallback(
    async (nextQuery: OssQuery, nextRange: [Dayjs, Dayjs] | null) => {
      setLoading(true);
      try {
        const response = await listOss(
          addDateRange({ ...nextQuery }, formatRange(nextRange), 'CreateTime'),
        );
        setList(response.rows);
        setTotal(response.total);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useInitialLoadEffect(() => {
    loadPreviewSetting();
    loadList(initialQuery, null);
  }, [loadList, loadPreviewSetting], {dedupeKey: 'system-oss-initial-list'});

  const columns: ColumnsType<OssVO> = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      align: 'center',
    },
    {
      title: '原名',
      dataIndex: 'originalName',
      align: 'center',
    },
    {
      title: '文件后缀',
      dataIndex: 'fileSuffix',
      width: 120,
      align: 'center',
    },
    {
      title: '文件展示',
      dataIndex: 'url',
      render: (value: string, record) =>
        previewListResource && isImage(record.fileSuffix) ? (
          <Image
            src={value}
            width={88}
            height={88}
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <span>{value}</span>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 160,
      align: 'center',
    },
    {
      title: '上传人',
      dataIndex: 'createByName',
      width: 120,
      align: 'center',
    },
    {
      title: '服务商',
      dataIndex: 'service',
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
          <Tooltip title="下载">
            <Button
              type="link"
              icon={<DownloadOutlined />}
              href={record.url}
              target="_blank"
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              danger
              type="link"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.ossId)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleDelete = async (
    ossId?: string | number | Array<string | number>,
  ) => {
    const target = ossId || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的文件');
      return;
    }
    const confirmed = await modal.confirm(
      `是否确认删除OSS对象存储编号为 "${Array.isArray(target) ? target.join(',') : target}" 的数据项？`,
    );
    if (!confirmed) {
      return;
    }
    await delOss(target);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList(query, dateRange);
  };

  const handlePreviewListResource = async () => {
    const nextValue = !previewListResource;
    const previousValue = previewListResource;
    setPreviewListResource(nextValue);
    setPreviewLoading(true);
    try {
      await updateConfigByKey('sys.oss.previewListResource', nextValue);
      await loadPreviewSetting();
      modal.msgSuccess(nextValue ? '启用成功' : '停用成功');
    } catch {
      setPreviewListResource(previousValue);
    } finally {
      setPreviewLoading(false);
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
                  label="文件名"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入文件名"
                    value={query.fileName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        fileName: event.target.value,
                      }))
                    }
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next, dateRange);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="原名"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入原名"
                    value={query.originalName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        originalName: event.target.value,
                      }))
                    }
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next, dateRange);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="文件后缀"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入文件后缀"
                    value={query.fileSuffix}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        fileSuffix: event.target.value,
                      }))
                    }
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next, dateRange);
                    }}
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
                    style={{ width: '100%' }}
                    value={dateRange}
                    onChange={(value) =>
                      setDateRange((value as [Dayjs, Dayjs]) || null)
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="服务商"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入服务商"
                    value={query.service}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        service: event.target.value,
                      }))
                    }
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next, dateRange);
                    }}
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
                        loadList(next, dateRange);
                      }}
                    >
                      搜索
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        setQuery(initialQuery);
                        setDateRange(null);
                        loadList(initialQuery, null);
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
              icon={<UploadOutlined />}
              onClick={() => {
                setUploadType('file');
                form.setFieldsValue({ file: undefined });
                setDialogOpen(true);
              }}
            >
              上传文件
            </Button>
            <Button
              className="btn-plain-primary"
              icon={<UploadOutlined />}
              onClick={() => {
                setUploadType('image');
                form.setFieldsValue({ file: undefined });
                setDialogOpen(true);
              }}
            >
              上传图片
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
            <Button
              icon={
                previewListResource ? <EyeInvisibleOutlined /> : <EyeOutlined />
              }
              loading={previewLoading}
              style={{
                color: previewListResource ? '#ff4d4f' : '#e6a23c',
                borderColor: previewListResource ? '#ffccc7' : '#ffd591',
              }}
              onClick={handlePreviewListResource}
            >
              预览开关 : {previewListResource ? '禁用' : '启用'}
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => navigate('/system/oss-config/index')}
            >
              配置管理
            </Button>
          </Space>
          <RightToolbar
            showSearch={showSearch}
            onShowSearchChange={setShowSearch}
            onQueryTable={() => loadList(query, dateRange)}
          />
        </div>

        <Table<OssVO>
          rowKey="ossId"
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

      <Modal
        open={dialogOpen}
        title={uploadType === 'file' ? '上传文件' : '上传图片'}
        onCancel={() => setDialogOpen(false)}
        onOk={() => {
          setDialogOpen(false);
          loadList(initialQuery, null);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="文件" name="file">
            {uploadType === 'file' ? (
              <FileUpload limit={1} />
            ) : (
              <ImageUpload limit={1} />
            )}
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
