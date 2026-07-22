import {Badge, Button, Empty, Popover, Tag, theme} from 'antd';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from '@umijs/max';
import SvgIcon from '@/components/SvgIcon';
import {useNoticeStore} from '@/store/modules/notice';

export default function NoticeBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const notices = useNoticeStore((state) => state.notices);
  const markRead = useNoticeStore((state) => state.markRead);
  const markAllRead = useNoticeStore((state) => state.markAllRead);
  const unreadCount = useNoticeStore((state) => state.unreadCount);
  const refresh = useNoticeStore((state) => state.refresh);
  const {
    token: { colorBorderSecondary, colorTextSecondary },
  } = theme.useToken();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const content = (
    <div style={{ width: 300 }} className="layout-notice-panel">
      <div
        style={{
          height: 35,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${colorBorderSecondary}`,
          boxSizing: 'border-box',
        }}
      >
        <div>{t('notice.title')}</div>
        <button
          type="button"
          onClick={() => void markAllRead()}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            color: '#1677ff',
            fontSize: 13,
            cursor: 'pointer',
            opacity: 0.85,
          }}
        >
          {t('notice.markAllRead')}
        </button>
      </div>
      <div style={{ height: 300, overflow: 'auto', fontSize: 13 }}>
        {notices.length > 0 ? (
          notices.slice(0, 10).map((item, index) => (
            <button
              type="button"
              key={item.messageId}
              onClick={() => void markRead(item.messageId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void markRead(item.messageId);
                }
              }}
              style={{
                width: '100%',
                border: 0,
                background: 'transparent',
                paddingTop: 12,
                paddingLeft: 0,
                paddingRight: 0,
                paddingBottom:
                  index === notices.slice(0, 10).length - 1 ? 12 : 0,
                display: 'flex',
                gap: 12,
                cursor: 'pointer',
                color: 'inherit',
                font: 'inherit',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                }}
              >
                <div>{item.title}</div>
                <div style={{ color: colorTextSecondary, marginTop: 5 }}>
                  {item.createTime}
                </div>
              </div>
              <Tag
                color={item.readTime ? 'success' : 'error'}
                style={{ alignSelf: 'center', marginInlineEnd: 0 }}
              >
                {item.readTime ? t('notice.read') : t('notice.unread')}
              </Tag>
            </button>
          ))
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('notice.empty')}
          />
        )}
      </div>
      <Button type="link" block onClick={() => { setPopoverOpen(false); navigate('/message-center'); }}>
        全部消息
      </Button>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={popoverOpen}
      onOpenChange={(open) => {
        setPopoverOpen(open);
        if (open) void refresh();
      }}
    >
      <Button
        type="text"
        aria-label={t('navbar.message')}
        title={t('navbar.message')}
        data-testid="layout-notice-button"
        icon={
          <Badge count={unreadCount} size="small">
            <SvgIcon
              iconClass="message"
              size={18}
              title={t('navbar.message')}
            />
          </Badge>
        }
      />
    </Popover>
  );
}
