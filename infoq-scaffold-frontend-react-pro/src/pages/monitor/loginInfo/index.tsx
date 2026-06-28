import {DeleteOutlined, DownloadOutlined, ReloadOutlined, SearchOutlined, UnlockOutlined,} from '@ant-design/icons';
import {Button, Card, Col, DatePicker, Form, Input, Row, Select, Space, Table,} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import type {SorterResult, SortOrder} from 'antd/es/table/interface';
import type {Dayjs} from 'dayjs';
import {useCallback, useState} from 'react';
import {cleanLoginInfo, delLoginInfo, list, unlockLoginInfo,} from '@/api/monitor/loginInfo';
import type {LoginInfoQuery, LoginInfoVO,} from '@/api/monitor/loginInfo/types';
import DictTag from '@/components/DictTag';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import useInitialLoadEffect from '@/hooks/useInitialLoadEffect';
import useDictOptions from '@/hooks/useDictOptions';
import modal from '@/utils/modal';
import {download} from '@/utils/request';
import {addDateRange} from '@/utils/scaffold';

type LoginInfoRow = LoginInfoVO & {
  clientKey?: string;
  deviceType?: string;
};

const initialQuery: LoginInfoQuery = {
  pageNum: 1,
  pageSize: 10,
  ipaddr: '',
  userName: '',
  status: '',
  orderByColumn: 'loginTime',
  isAsc: 'descending',
};

const defaultSortColumn = 'loginTime';

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

export default function LoginInfoPage() {
  const [query, setQuery] = useState<LoginInfoQuery>(initialQuery);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [listData, setListData] = useState<LoginInfoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const dict = useDictOptions('sys_device_type', 'sys_common_status');

  const loadList = useCallback(
    async (nextQuery: LoginInfoQuery, nextRange: [Dayjs, Dayjs] | null) => {
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

  const columns: ColumnsType<LoginInfoRow> = [
    {
      title: '访问编号',
      dataIndex: 'infoId',
      align: 'center',
    },
    {
      title: '用户名称',
      dataIndex: 'userName',
      align: 'center',
      ellipsis: true,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder:
        query.orderByColumn === 'userName'
          ? toAntSortOrder(query.isAsc)
          : undefined,
    },
    {
      title: '客户端',
      dataIndex: 'clientKey',
      width: 90,
      align: 'center',
      ellipsis: true,
    },
    {
      title: '设备类型',
      dataIndex: 'deviceType',
      width: 90,
      align: 'center',
      render: (value: string) => (
        <DictTag options={dict.sys_device_type || []} value={value} />
      ),
    },
    {
      title: '地址',
      dataIndex: 'ipaddr',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '登录地点',
      dataIndex: 'loginLocation',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '操作系统',
      dataIndex: 'os',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '浏览器',
      dataIndex: 'browser',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '登录状态',
      dataIndex: 'status',
      width: 90,
      align: 'center',
      render: (value: string) => (
        <DictTag options={dict.sys_common_status || []} value={value} />
      ),
    },
    {
      title: '描述',
      dataIndex: 'msg',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '访问时间',
      dataIndex: 'loginTime',
      width: 180,
      align: 'center',
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder:
        query.orderByColumn === 'loginTime'
          ? toAntSortOrder(query.isAsc)
          : undefined,
    },
  ];

  const handleDelete = async () => {
    if (selectedIds.length === 0) {
      modal.msgWarning('请选择要删除的登录日志');
      return;
    }
    const confirmed = await modal.confirm(
      `是否确认删除访问编号为 "${selectedIds.join(',')}" 的数据项？`,
    );
    if (!confirmed) {
      return;
    }
    await delLoginInfo(selectedIds);
    modal.msgSuccess('删除成功');
    setSelectedIds([]);
    loadList(query, dateRange);
  };

  const handleUnlock = async () => {
    if (selectedNames.length !== 1) {
      modal.msgWarning('请选择一条需要解锁的记录');
      return;
    }
    const confirmed = await modal.confirm(
      `是否确认解锁用户 "${selectedNames[0]}" 数据项？`,
    );
    if (!confirmed) {
      return;
    }
    await unlockLoginInfo(selectedNames);
    modal.msgSuccess(`用户 ${selectedNames[0]} 解锁成功`);
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {showSearch && (
        <Card>
          <Form layout="inline" className="query-form">
            <Row gutter={16} style={{ width: '100%' }}>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="登录地址"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入登录地址"
                    value={query.ipaddr}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        ipaddr: event.target.value,
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
                  label="用户名称"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入用户名称"
                    value={query.userName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        userName: event.target.value,
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
                  label="状态"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="登录状态"
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
                  label="登录时间"
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
              onClick={handleDelete}
              disabled={selectedIds.length === 0}
            >
              删除
            </Button>
            <Button
              className="btn-plain-danger"
              icon={<DeleteOutlined />}
              onClick={async () => {
                const confirmed = await modal.confirm(
                  '是否确认清空所有登录日志数据项？',
                );
                if (!confirmed) {
                  return;
                }
                await cleanLoginInfo();
                modal.msgSuccess('清空成功');
                loadList(query, dateRange);
              }}
            >
              清空
            </Button>
            <Button
              className="btn-plain-primary"
              icon={<UnlockOutlined />}
              onClick={handleUnlock}
              disabled={selectedNames.length !== 1}
            >
              解锁
            </Button>
            <Button
              className="btn-plain-warning"
              icon={<DownloadOutlined />}
              onClick={() =>
                download(
                  '/monitor/loginInfo/export',
                  addDateRange({ ...query }, formatRange(dateRange)),
                  `loginInfo_${Date.now()}.xlsx`,
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

        <Table<LoginInfoRow>
          rowKey="infoId"
          loading={loading}
          bordered
          columns={columns}
          dataSource={listData}
          pagination={false}
          onChange={(_, __, sorter) => {
            const currentSorter = (
              Array.isArray(sorter) ? sorter[0] : sorter
            ) as SorterResult<LoginInfoRow> | undefined;
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
            columnWidth: 55,
            onChange: (keys, rows) => {
              setSelectedIds(keys as Array<string | number>);
              setSelectedNames(
                rows.map((item) => String((item as LoginInfoRow).userName)),
              );
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
    </Space>
  );
}
