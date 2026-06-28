import {LogoutOutlined, SettingOutlined, SkinOutlined,} from '@ant-design/icons';
import {history, useModel} from '@umijs/max';
import type {MenuProps} from 'antd';
import {Dropdown, Spin} from 'antd';
import React, {startTransition} from 'react';
import {useTranslation} from 'react-i18next';
import {useSettingsStore} from '@/store/modules/settings';
import {useUserStore} from '@/store/modules/user';

type GlobalHeaderRightProps = {
  children?: React.ReactNode;
};

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({
  children,
}) => {
  const { t } = useTranslation();
  const showSettings = useSettingsStore((state) => state.showSettings);
  const loginOut = async () => {
    await useUserStore
      .getState()
      .logout()
      .catch(() => undefined);
    const { search, pathname } = window.location;
    const urlParams = new URL(window.location.href).searchParams;
    const searchParams = new URLSearchParams({
      redirect: pathname + search,
    });
    const redirect = urlParams.get('redirect');
    if (window.location.pathname !== '/login' && !redirect) {
      history.replace({
        pathname: '/login',
        search: searchParams.toString(),
      });
    }
  };
  const { initialState, setInitialState } = useModel('@@initialState');

  const onMenuClick: MenuProps['onClick'] = (event) => {
    const { key } = event;
    if (key === 'logout') {
      startTransition(() => {
        setInitialState((s) => ({ ...s, currentUser: undefined }));
      });
      loginOut();
      return;
    }
    if (key === 'layout') {
      setInitialState((s) => ({ ...s, settingDrawerOpen: true }));
      return;
    }
    history.push('/user/profile');
  };

  if (!initialState) {
    return <Spin size="small" />;
  }

  const { currentUser } = initialState;

  if (!currentUser) {
    return <Spin size="small" />;
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: t('navbar.personalCenter'),
    },
    ...(showSettings
      ? [
          {
            key: 'layout',
            icon: <SkinOutlined />,
            label: t('navbar.layoutSetting'),
          },
        ]
      : []),
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('common.logout'),
    },
  ];

  return (
    <Dropdown
      placement="bottomRight"
      menu={{
        selectedKeys: [],
        onClick: onMenuClick,
        items: menuItems,
      }}
      arrow
    >
      {children}
    </Dropdown>
  );
};
