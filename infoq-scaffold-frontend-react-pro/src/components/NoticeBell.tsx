import { Badge, Button, Empty, Popover, Tag, Tooltip, theme } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SvgIcon from '@/components/SvgIcon';
import { useNoticeStore } from '@/store/modules/notice';

export default function NoticeBell() {
  const { t } = useTranslation();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const notices = useNoticeStore((state) => state.notices);
  const markRead = useNoticeStore((state) => state.markRead);
  const markAllRead = useNoticeStore((state) => state.markAllRead);
  const unreadCount = notices.filter((item) => !item.read).length;
  const {
    token: { colorBorderSecondary, colorTextSecondary },
  } = theme.useToken();

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
          onClick={markAllRead}
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
              key={`${item.time}-${item.message}`}
              onClick={() => markRead(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  markRead(index);
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
                <div>{item.message}</div>
                <div style={{ color: colorTextSecondary, marginTop: 5 }}>
                  {item.time}
                </div>
              </div>
              <Tag
                color={item.read ? 'success' : 'error'}
                style={{ alignSelf: 'center', marginInlineEnd: 0 }}
              >
                {item.read ? t('notice.read') : t('notice.unread')}
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
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
    >
      <span style={{ display: 'inline-flex' }}>
        <Tooltip
          title={t('navbar.message')}
          open={popoverOpen ? false : undefined}
        >
          <Button
            type="text"
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
        </Tooltip>
      </span>
    </Popover>
  );
}
