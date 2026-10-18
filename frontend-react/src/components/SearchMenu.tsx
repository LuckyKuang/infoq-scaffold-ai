import { AutoComplete, Button, Input, Modal, theme, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AppRoute } from '@/types/router';
import { usePermissionStore } from '@/store/modules/permission';
import MenuIcon from '@/components/MenuIcon';
import SvgIcon from '@/components/SvgIcon';
import { isHttp } from '@/utils/validate';

type SearchRoute = {
  path: string;
  icon?: string;
  title: string;
};

const collectSearchRoutes = (routes: AppRoute[], prefixTitles: string[] = []): SearchRoute[] => {
  const items: SearchRoute[] = [];

  routes.forEach((route) => {
    if (route.hidden) {
      return;
    }

    const nextTitles = route.meta?.title ? [...prefixTitles, route.meta.title] : [...prefixTitles];
    if (route.meta?.title && route.redirect !== 'noRedirect') {
      items.push({
        path: route.path,
        icon: route.meta.icon,
        title: nextTitles.join('/')
      });
    }

    if (route.children?.length) {
      items.push(...collectSearchRoutes(route.children, nextTitles));
    }
  });

  return items;
};

export default function SearchMenu() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const routes = usePermissionStore((state) => state.routes);
  const inputRef = useRef<InputRef>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const {
    token: { colorText }
  } = theme.useToken();

  const menuList = useMemo(() => collectSearchRoutes(routes), [routes]);
  const options = useMemo(
    () =>
      menuList
        .filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 20)
        .map((item) => ({
          value: item.path,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MenuIcon iconClass={item.icon} />
              <span>{item.title}</span>
            </div>
          )
        })),
    [menuList, query]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery('');
    if (isHttp(path)) {
      window.open(path, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(path);
  };

  return (
    <>
      <Tooltip title={t('navbar.search')} open={open ? false : undefined}>
        <Button
          type="text"
          icon={<SvgIcon iconClass="search" size={18} title={t('navbar.search')} />}
          onClick={() => {
            setQuery('');
            setOpen(true);
          }}
        />
      </Tooltip>
      <Modal open={open} footer={null} onCancel={() => setOpen(false)} closable={false} centered width={620} styles={{ body: { padding: 24 } }}>
        <AutoComplete
          value={query}
          options={options}
          onSearch={setQuery}
          onSelect={handleSelect}
          style={{ width: '100%' }}
        >
          <Input
            ref={inputRef}
            size="large"
            prefix={<SvgIcon iconClass="search" size={16} style={{ color: colorText }} />}
            placeholder={t('navbar.search')}
          />
        </AutoComplete>
      </Modal>
    </>
  );
}
