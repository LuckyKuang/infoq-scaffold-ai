import {
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {Button, Card, Col, DatePicker, Form, Input, Row, Select, Space, Table, Tooltip,} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import type {SorterResult, SortOrder} from 'antd/es/table/interface';
import type {Dayjs} from 'dayjs';
import {useCallback, useState} from 'react';
import {cleanOperLog, delOperLog, list} from '@/api/monitor/operLog';
import type {OperLogQuery, OperLogVO} from '@/api/monitor/operLog/types';
import DictTag from '@/components/DictTag';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import useInitialLoadEffect from '@/hooks/useInitialLoadEffect';
import useDictOptions from '@/hooks/useDictOptions';
import OperInfoDialog from '@/pages/monitor/operLog/oper-info-dialog';
import modal from '@/utils/modal';
import {download} from '@/utils/request';
import {addDateRange} from '@/utils/scaffold';

const initialQuery: OperLogQuery = {
  pageNum: 1,
  pageSize: 10,
  operIp: '',
  title: '',
  operName: '',
  businessType: '',
  status: '',
  orderByColumn: 'operTime',
  isAsc: 'descending',
};

const defaultSortColumn = 'operTime';

const toBackendSortOrder = (order?: SortOrder) => {
  if (order === 'ascend') {
    return 'ascending';
  }
  if (order === 'descend') {
    return 'descending';
  }
  return undefined;
};

const toAntSortOrder = (value?: string): SortOrder | undefined => {
  if (value === 'ascending') {
    return 'ascend';
  }
  if (value === 'descending') {
    return 'descend';
  }
  return undefined;
};

const formatRange = (range: [Dayjs, Dayjs] | null) =>
  range
    ? [
        range[0].format('YYYY-MM-DD HH:mm:ss'),
        range[1].format('YYYY-MM-DD HH:mm:ss'),
      ]
    : [];

export default function OperLogPage() {
  const [query, setQuery] = useState<OperLogQuery>(initialQuery);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [listData, setListData] = useState<OperLogVO[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState<OperLogVO | null>(null);
  const dict = useDictOptions('sys_oper_type', 'sys_common_status');

  const loadList = useCallback(
    async (nextQuery: OperLogQuery, nextRange: [Dayjs, Dayjs] | null) => {
      setLoading(true);
      try {
        const response = await list(
          addDateRange({ ...nextQuery }, formatRange(nextRange)),
        );
        setListData(response.rows);
        setTotal(response.total);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useInitialLoadEffect(() => {
    loadList(initialQuery, null);
  }, [loadList]);

  const columns: ColumnsType<OperLogVO> = [
    {
      title: '日志编号',
      dataIndex: 'operId',
      align: 'center',
    },
    {
      title: '系统模块',
      dataIndex: 'title',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '操作类型',
      dataIndex: 'businessType',
      align: 'center',
      render: (value: number) => (
        <DictTag options={dict.sys_oper_type || []} value={String(value)} />
      ),
    },
    {
      title: '操作人员',
      dataIndex: 'operName',
      width: 110,
      align: 'center',
      ellipsis: true,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder:
        query.orderByColumn === 'operName'
          ? toAntSortOrder(query.isAsc)
          : undefined,
    },
    {
      title: '部门',
      dataIndex: 'deptName',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '操作地址',
      dataIndex: 'operIp',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '操作状态',
      dataIndex: 'status',
      align: 'center',
      render: (value: number) => (
        <DictTag options={dict.sys_common_status || []} value={String(value)} />
      ),
    },
    {
      title: '操作日期',
      dataIndex: 'operTime',
      width: 180,
      align: 'center',
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder:
        query.orderByColumn === 'operTime'
          ? toAntSortOrder(query.isAsc)
          : undefined,
    },
    {
      title: '消耗时间',
      dataIndex: 'costTime',
      width: 110,
      align: 'center',
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder:
        query.orderByColumn === 'costTime'
          ? toAntSortOrder(query.isAsc)
          : undefined,
      render: (value: number) => `${value}毫秒`,
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="详细">
          <Button
            className="table-action-link"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setActiveRecord(record);
              setDetailOpen(true);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {showSearch && (
        <Card>
          <Form layout="inline" className="query-form">
            <Row gutter={16} style={{ width: '100%' }}>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="操作地址"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入操作地址"
                    value={query.operIp}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        operIp: event.target.value,
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
                  label="系统模块"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入系统模块"
                    value={query.title}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        title: event.target.value,
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
                  label="操作人员"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入操作人员"
                    value={query.operName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        operName: event.target.value,
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
                  label="类型"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="操作类型"
                    value={query.businessType || undefined}
                    options={(dict.sys_oper_type || []).map((item) => ({
                      label: item.label,
                      value: item.value,
                    }))}
                    onChange={(value) =>
                      setQuery((prev) => ({
                        ...prev,
                        businessType: value || '',
                      }))
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="状态"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="操作状态"
                    value={query.status || undefined}
                    options={(dict.sys_common_status || []).map((item) => ({
                      label: item.label,
                      value: item.value,
                    }))}
                    onChange={(value) =>
                      setQuery((prev) => ({ ...prev, status: value || '' }))
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="操作时间"
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
                        const resetQuery = {
                          ...initialQuery,
                          orderByColumn: defaultSortColumn,
                          isAsc: 'descending',
                        };
                        setQuery(resetQuery);
                        setDateRange(null);
                        loadList(resetQuery, null);
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
            <Button
              className="btn-plain-danger"
              icon={<DeleteOutlined />}
              disabled={selectedIds.length === 0}
              onClick={async () => {
                const confirmed = await modal.confirm(
                  `是否确认删除日志编号为 "${selectedIds.join(',')}" 的数据项？`,
                );
                if (!confirmed) {
                  return;
                }
                await delOperLog(selectedIds);
                modal.msgSuccess('删除成功');
                setSelectedIds([]);
                loadList(query, dateRange);
              }}
            >
              删除
            </Button>
            <Button
              className="btn-plain-danger"
              icon={<WarningOutlined />}
              onClick={async () => {
                const confirmed = await modal.confirm(
                  '是否确认清空所有操作日志数据项？',
                );
                if (!confirmed) {
                  return;
                }
                await cleanOperLog();
                modal.msgSuccess('清空成功');
                loadList(query, dateRange);
              }}
            >
              清空
            </Button>
            <Button
              className="btn-plain-warning"
              icon={<DownloadOutlined />}
              onClick={() =>
                download(
                  '/monitor/operLog/export',
                  addDateRange({ ...query }, formatRange(dateRange)),
                  `operLog_${Date.now()}.xlsx`,
                )
              }
            >
              导出
            </Button>
          </Space>
          <div className="right-toolbar-wrap">
            <RightToolbar
              showSearch={showSearch}
              onShowSearchChange={setShowSearch}
              onQueryTable={() => loadList(query, dateRange)}
            />
          </div>
        </div>

        <Table<OperLogVO>
          rowKey="operId"
          loading={loading}
          bordered
          columns={columns}
          dataSource={listData}
          pagination={false}
          onChange={(_, __, sorter) => {
            const currentSorter = (
              Array.isArray(sorter) ? sorter[0] : sorter
            ) as SorterResult<OperLogVO> | undefined;
            const nextOrderByColumn = currentSorter?.field
              ? String(currentSorter.field)
              : defaultSortColumn;
            const nextIsAsc =
              toBackendSortOrder(currentSorter?.order) || 'descending';
            const next = {
              ...query,
              pageNum: 1,
              orderByColumn: nextOrderByColumn,
              isAsc: nextIsAsc,
            };
            setQuery(next);
            loadList(next, dateRange);
          }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            columnWidth: 50,
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

      <OperInfoDialog
        open={detailOpen}
        record={activeRecord}
        onClose={() => setDetailOpen(false)}
      />
    </Space>
  );
}
