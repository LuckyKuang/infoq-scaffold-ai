import {CheckOutlined, DeleteOutlined} from '@ant-design/icons';
import {Button, Card, Empty, List, Popconfirm, Space, Tag, Typography} from 'antd';
import {useEffect} from 'react';
import {useNoticeStore} from '@/store/modules/notice';

const levelColor: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'orange',
  error: 'red',
};

export default function MessageCenterPage() {
  const notices = useNoticeStore((state) => state.notices);
  const loading = useNoticeStore((state) => state.loading);
  const refresh = useNoticeStore((state) => state.refresh);
  const markRead = useNoticeStore((state) => state.markRead);
  const markAllRead = useNoticeStore((state) => state.markAllRead);
  const deleteByIds = useNoticeStore((state) => state.deleteByIds);

  useEffect(() => {
    void refresh(100);
  }, [refresh]);

  return (
    <Card
      title="消息中心"
      extra={<Button icon={<CheckOutlined />} onClick={() => void markAllRead()}>全部标为已读</Button>}
    >
      {notices.length === 0 && !loading ? <Empty description="暂无消息" /> : (
        <List
          loading={loading}
          dataSource={notices}
          renderItem={(item) => (
            <List.Item
              key={item.messageId}
              actions={[
                !item.readTime ? <Button key="read" type="link" onClick={() => void markRead(item.messageId)}>标为已读</Button> : null,
                <Popconfirm key="delete" title="确认删除这条消息？" onConfirm={() => void deleteByIds([item.messageId])}>
                  <Button type="text" danger icon={<DeleteOutlined />} aria-label="删除消息" />
                </Popconfirm>,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={<Space><Typography.Text strong={!item.readTime}>{item.title}</Typography.Text><Tag color={levelColor[item.messageLevel] || 'default'}>{item.messageLevel}</Tag></Space>}
                description={<><Typography.Paragraph style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>{item.content || ''}</Typography.Paragraph><Typography.Text type="secondary">{item.createTime}</Typography.Text></>}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
