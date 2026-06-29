import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, Row, Space, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import useDictOptions from '@/hooks/useDictOptions';
import { forceLogout, list } from '@/api/monitor/online';
import type { OnlineQuery, OnlineVO } from '@/api/monitor/online/types';
import DictTag from '@/components/DictTag';
import Pagination from '@/components/Pagination';
import modal from '@/utils/modal';
import auth from '@/utils/permission';
import { parseTime } from '@/utils/scaffold';

type OnlineRow = OnlineVO & {
  clientKey?: string;
  deviceType?: string;
};

const initialQuery: OnlineQuery = {
  pageNum: 1,
  pageSize: 10,
  ipaddr: '',
  userName: ''
};

export default function OnlinePage() {
  const [query, setQuery] = useState<OnlineQuery>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [listData, setListData] = useState<OnlineRow[]>([]);
  const [total, setTotal] = useState(0);
  const dict = useDictOptions('sys_device_type');

  const loadList = useCallback(
    async (nextQuery: OnlineQuery = query) => {
      setLoading(true);
      try {
        const response = await list(nextQuery);
        setListData(response.rows);
        setTotal(response.total);
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  useEffect(() => {
    loadList(initialQuery);
  }, [loadList]);

  const columns = useMemo<ColumnsType<OnlineRow>>(
    () => [
      {
        title: '序号',
        key: 'index',
        width: 50,
        align: 'center',
        render: (_, __, index) => (query.pageNum - 1) * query.pageSize + index + 1
      },
      {
        title: '会话编号',
        dataIndex: 'tokenId',
        align: 'center',
        ellipsis: true
      },
      {
        title: '登录名称',
        dataIndex: 'userName',
        align: 'center',
        ellipsis: true
      },
      {
        title: '客户端',
        dataIndex: 'clientKey',
        align: 'center',
        ellipsis: true
      },
      {
        title: '设备类型',
        dataIndex: 'deviceType',
        align: 'center',
        render: (value: string) => <DictTag options={dict.sys_device_type || []} value={value} />
      },
      {
        title: '所属部门',
        dataIndex: 'deptName',
        align: 'center',
        ellipsis: true
      },
      {
        title: '主机',
        dataIndex: 'ipaddr',
        align: 'center',
        ellipsis: true
      },
      {
        title: '登录地点',
        dataIndex: 'loginLocation',
        align: 'center',
        ellipsis: true
      },
      {
        title: '操作系统',
        dataIndex: 'os',
        align: 'center',
        ellipsis: true
      },
      {
        title: '浏览器',
        dataIndex: 'browser',
        align: 'center',
        ellipsis: true
      },
      {
        title: '登录时间',
        dataIndex: 'loginTime',
        align: 'center',
        width: 180,
        render: (value: string | number) => parseTime(value)
      },
      {
        title: '操作',
        key: 'action',
        width: 80,
        align: 'center',
        render: (_, record) =>
          auth.hasPermiOr(['monitor:online:forceLogout']) ? (
            <Tooltip title="强退">
              <Button
                className="table-action-link"
                type="link"
                icon={<DeleteOutlined />}
                onClick={async () => {
                  const confirmed = await modal.confirm(`是否确认强退名称为 "${record.userName}" 的用户？`);
                  if (!confirmed) {
                    return;
                  }
                  await forceLogout(record.tokenId);
                  modal.msgSuccess('删除成功');
                  loadList();
                }}
              />
            </Tooltip>
          ) : null
      }
    ],
    [dict.sys_device_type, loadList, query.pageNum, query.pageSize]
  );

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Card>
        <Form layout="inline" className="query-form">
          <Row gutter={16} style={{ width: '100%' }}>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="登录地址" style={{ width: '100%', marginBottom: 12 }}>
                <Input
                  allowClear
                  placeholder="请输入登录地址"
                  value={query.ipaddr}
                  onChange={(event) => setQuery((prev) => ({ ...prev, ipaddr: event.target.value }))}
                  onPressEnter={() => {
                    const next = { ...query, pageNum: 1 };
                    setQuery(next);
                    loadList(next);
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="用户名称" style={{ width: '100%', marginBottom: 12 }}>
                <Input
                  allowClear
                  placeholder="请输入用户名称"
                  value={query.userName}
                  onChange={(event) => setQuery((prev) => ({ ...prev, userName: event.target.value }))}
                  onPressEnter={() => {
                    const next = { ...query, pageNum: 1 };
                    setQuery(next);
                    loadList(next);
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item style={{ marginBottom: 12 }}>
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

      <Card>
        <Table<OnlineRow> rowKey="tokenId" bordered loading={loading} columns={columns} dataSource={listData} pagination={false} />
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
    </Space>
  );
}
