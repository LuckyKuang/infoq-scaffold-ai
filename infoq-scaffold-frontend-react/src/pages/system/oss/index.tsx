import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DeleteOutlined,
  DownloadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { Button, Card, Col, DatePicker, Form, Image, Input, Row, Space, Table, Tooltip, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import type { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { delOss, listOss, uploadOss } from '@/api/system/oss';
import { getConfigKey, updateConfigByKey } from '@/api/system/config';
import type { OssForm, OssQuery, OssVO } from '@/api/system/oss/types';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import CrudModal from '@/components/CrudModal';
import modal from '@/utils/modal';
import auth from '@/utils/permission';
import { addDateRange } from '@/utils/scaffold';

const initialQuery: OssQuery = {
  pageNum: 1,
  pageSize: 10,
  fileName: '',
  originalName: '',
  fileSuffix: '',
  createTime: '',
  service: '',
  orderByColumn: 'createTime',
  isAsc: 'ascending'
};

const formatRange = (range: [Dayjs, Dayjs] | null) => (range ? [range[0].format('YYYY-MM-DD HH:mm:ss'), range[1].format('YYYY-MM-DD HH:mm:ss')] : []);

const isImage = (suffix?: string) => ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes((suffix || '').toLowerCase());

const fileUploadTypes = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'pdf'];
const imageUploadTypes = ['png', 'jpg', 'jpeg'];
const maxUploadSizeMb = 5;

const getFileExtension = (fileName: string) => (fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase() : '');

const getLocalThumbUrl = (file: UploadFile, type: 'file' | 'image') => {
  if (type !== 'image' || file.thumbUrl || !(file.originFileObj instanceof Blob) || typeof URL.createObjectURL !== 'function') {
    return file.thumbUrl;
  }
  return URL.createObjectURL(file.originFileObj);
};

const validatePendingUploadFile = (file: File, type: 'file' | 'image') => {
  const fileName = file.name || '';
  const fileExt = getFileExtension(fileName);
  const allowedTypes = type === 'image' ? imageUploadTypes : fileUploadTypes;
  const allowed = type === 'image' ? allowedTypes.includes(fileExt) || file.type.startsWith('image/') : allowedTypes.includes(fileExt);
  if (!allowed) {
    modal.msgError(
      type === 'image' ? `文件格式不正确，请上传 ${allowedTypes.join('/')} 图片格式文件` : `文件格式不正确，请上传 ${allowedTypes.join('/')} 格式文件`
    );
    return false;
  }
  if (fileName.includes(',')) {
    modal.msgError('文件名不能包含英文逗号');
    return false;
  }
  if (file.size / 1024 / 1024 > maxUploadSizeMb) {
    modal.msgError(type === 'image' ? `上传图片大小不能超过 ${maxUploadSizeMb}MB` : `上传文件大小不能超过 ${maxUploadSizeMb}MB`);
    return false;
  }
  return true;
};

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
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<UploadFile[]>([]);
  const localThumbUrlsRef = useRef<string[]>([]);
  const [form] = Form.useForm<OssForm>();

  const loadPreviewSetting = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const response = await getConfigKey('sys.oss.previewListResource');
      setPreviewListResource(response.data === undefined ? true : response.data === 'true');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const loadList = useCallback(async (nextQuery: OssQuery, nextRange: [Dayjs, Dayjs] | null) => {
    setLoading(true);
    try {
      const response = await listOss(addDateRange({ ...nextQuery }, formatRange(nextRange), 'CreateTime'));
      setList(response.rows);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreviewSetting();
    loadList(initialQuery, null);
  }, [loadList, loadPreviewSetting]);

  const columns: ColumnsType<OssVO> = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      align: 'center'
    },
    {
      title: '原名',
      dataIndex: 'originalName',
      align: 'center'
    },
    {
      title: '文件后缀',
      dataIndex: 'fileSuffix',
      width: 120,
      align: 'center'
    },
    {
      title: '文件展示',
      dataIndex: 'url',
      render: (value: string, record) =>
        previewListResource && isImage(record.fileSuffix) ? (
          <Image src={value} width={88} height={88} style={{ objectFit: 'cover' }} />
        ) : (
          <span>{value}</span>
        )
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 160,
      align: 'center'
    },
    {
      title: '上传人',
      dataIndex: 'createByName',
      width: 120,
      align: 'center'
    },
    {
      title: '服务商',
      dataIndex: 'service',
      width: 120,
      align: 'center'
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          {auth.hasPermiOr(['system:oss:download']) && (
            <Tooltip title="下载">
              <Button type="link" icon={<DownloadOutlined />} href={record.url} target="_blank" />
            </Tooltip>
          )}
          {auth.hasPermiOr(['system:oss:remove']) && (
            <Tooltip title="删除">
              <Button danger type="link" icon={<DeleteOutlined />} onClick={() => handleDelete(record.ossId)} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const handleDelete = async (ossId?: string | number | Array<string | number>) => {
    const target = ossId || selectedIds;
    if (!target || (Array.isArray(target) && target.length === 0)) {
      modal.msgWarning('请选择要删除的文件');
      return;
    }
    const confirmed = await modal.confirm(`是否确认删除OSS对象存储编号为 "${Array.isArray(target) ? target.join(',') : target}" 的数据项？`);
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

  const revokeLocalThumbUrls = useCallback(() => {
    if (typeof URL.revokeObjectURL !== 'function') {
      localThumbUrlsRef.current = [];
      return;
    }
    localThumbUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    localThumbUrlsRef.current = [];
  }, []);

  useEffect(() => revokeLocalThumbUrls, [revokeLocalThumbUrls]);

  const resetPendingUpload = () => {
    revokeLocalThumbUrls();
    form.setFieldsValue({ file: undefined });
    setPendingUploadFiles([]);
  };

  const openUploadDialog = (type: 'file' | 'image') => {
    setUploadType(type);
    resetPendingUpload();
    setDialogOpen(true);
  };

  const closeUploadDialog = () => {
    setDialogOpen(false);
    resetPendingUpload();
  };

  const uploadAccept =
    uploadType === 'image' ? imageUploadTypes.map((type) => `.${type}`).join(',') : fileUploadTypes.map((type) => `.${type}`).join(',');

  const uploadTip =
    uploadType === 'image'
      ? `请上传大小不超过 ${maxUploadSizeMb}MB，格式为 ${imageUploadTypes.join('/')} 的图片`
      : `请上传大小不超过 ${maxUploadSizeMb}MB，格式为 ${fileUploadTypes.join('/')} 的文件`;

  const pendingUploadProps: UploadProps = {
    name: 'file',
    maxCount: 1,
    accept: uploadAccept,
    listType: uploadType === 'image' ? 'picture-card' : 'text',
    fileList: pendingUploadFiles,
    beforeUpload(file) {
      if (!validatePendingUploadFile(file, uploadType)) {
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    onChange(info) {
      const next = info.fileList.slice(-1).map((item) => ({
        ...item,
        thumbUrl: getLocalThumbUrl(item, uploadType),
        status: 'done' as const
      }));
      next.forEach((item) => {
        if (item.thumbUrl?.startsWith('blob:')) {
          localThumbUrlsRef.current.push(item.thumbUrl);
        }
      });
      setPendingUploadFiles(next);
      form.setFieldsValue({ file: next[0]?.name });
    },
    onRemove() {
      resetPendingUpload();
      return true;
    }
  };

  const handleUploadSubmit = async () => {
    const file = pendingUploadFiles[0]?.originFileObj;
    if (!(file instanceof Blob)) {
      modal.msgWarning('请选择要上传的文件');
      return;
    }

    setUploadSubmitting(true);
    modal.loading(uploadType === 'image' ? '正在上传图片，请稍候...' : '正在上传文件，请稍候...');
    try {
      await uploadOss(file, 'file');
      modal.msgSuccess('上传成功');
      closeUploadDialog();
      loadList(query, dateRange);
    } catch {
      modal.msgError(uploadType === 'image' ? '上传图片失败' : '上传文件失败');
    } finally {
      modal.closeLoading();
      setUploadSubmitting(false);
    }
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {showSearch && (
        <Card>
          <Form layout="inline" className="query-form">
            <Row gutter={16} style={{ width: '100%' }}>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="文件名" style={{ width: '100%', marginBottom: 12 }}>
                  <Input
                    allowClear
                    placeholder="请输入文件名"
                    value={query.fileName}
                    onChange={(event) => setQuery((prev) => ({ ...prev, fileName: event.target.value }))}
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next, dateRange);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="原名" style={{ width: '100%', marginBottom: 12 }}>
                  <Input
                    allowClear
                    placeholder="请输入原名"
                    value={query.originalName}
                    onChange={(event) => setQuery((prev) => ({ ...prev, originalName: event.target.value }))}
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next, dateRange);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="文件后缀" style={{ width: '100%', marginBottom: 12 }}>
                  <Input
                    allowClear
                    placeholder="请输入文件后缀"
                    value={query.fileSuffix}
                    onChange={(event) => setQuery((prev) => ({ ...prev, fileSuffix: event.target.value }))}
                    onPressEnter={() => {
                      const next = { ...query, pageNum: 1 };
                      setQuery(next);
                      loadList(next, dateRange);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="创建时间" style={{ width: '100%', marginBottom: 12 }}>
                  <DatePicker.RangePicker
                    showTime
                    placeholder={['开始日期', '结束日期']}
                    style={{ width: '100%' }}
                    value={dateRange}
                    onChange={(value) => setDateRange((value as [Dayjs, Dayjs]) || null)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item label="服务商" style={{ width: '100%', marginBottom: 12 }}>
                  <Input
                    allowClear
                    placeholder="请输入服务商"
                    value={query.service}
                    onChange={(event) => setQuery((prev) => ({ ...prev, service: event.target.value }))}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <Space wrap>
            {auth.hasPermiOr(['system:oss:upload']) && (
              <Button className="btn-plain-primary" icon={<UploadOutlined />} onClick={() => openUploadDialog('file')}>
                上传文件
              </Button>
            )}
            {auth.hasPermiOr(['system:oss:upload']) && (
              <Button className="btn-plain-primary" icon={<UploadOutlined />} onClick={() => openUploadDialog('image')}>
                上传图片
              </Button>
            )}
            {auth.hasPermiOr(['system:oss:remove']) && (
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
            {auth.hasPermiOr(['system:oss:edit']) && (
              <Button
                icon={previewListResource ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                loading={previewLoading}
                className={previewListResource ? 'btn-plain-danger' : 'btn-plain-warning'}
                onClick={handlePreviewListResource}
              >
                预览开关 : {previewListResource ? '禁用' : '启用'}
              </Button>
            )}
            {auth.hasPermiOr(['system:ossConfig:list']) && (
              <Button icon={<SettingOutlined />} onClick={() => navigate('/system/oss-config/index')}>
                配置管理
              </Button>
            )}
          </Space>
          <RightToolbar showSearch={showSearch} onShowSearchChange={setShowSearch} onQueryTable={() => loadList(query, dateRange)} />
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
            loadList(next, dateRange);
          }}
        />
      </Card>

      <CrudModal
        open={dialogOpen}
        title={uploadType === 'file' ? '上传文件' : '上传图片'}
        confirmLoading={uploadSubmitting}
        okText="确 定"
        cancelText="取 消"
        onCancel={closeUploadDialog}
        onOk={handleUploadSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="文件" name="file">
            <div className="oss-pending-upload">
              <Upload {...pendingUploadProps}>
                {pendingUploadFiles.length >= 1 ? null : uploadType === 'image' ? (
                  <PlusOutlined />
                ) : (
                  <Button icon={<UploadOutlined />}>选取文件</Button>
                )}
              </Upload>
              <div style={{ color: 'rgba(0, 0, 0, 0.45)', marginTop: 6 }}>{uploadTip}</div>
            </div>
          </Form.Item>
        </Form>
      </CrudModal>
    </Space>
  );
}
