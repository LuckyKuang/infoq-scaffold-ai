import { useEffect, useState } from 'react';
import { Card, Col, Row, Tabs, theme } from 'antd';
import type { UserVO } from '@/api/system/user/types';
import type { OnlineVO } from '@/api/monitor/online/types';
import { getOnline } from '@/api/monitor/online';
import { getUserProfile } from '@/api/system/user';
import { assertUserProfileData } from '@/api/system/user/guards';
import UserAvatar from '@/pages/system/user/profile/userAvatar';
import UserInfo from '@/pages/system/user/profile/userInfo';
import ResetPwd from '@/pages/system/user/profile/resetPwd';
import OnlineDevice from '@/pages/system/user/profile/onlineDevice';
import OauthIdentityPanel from '@/pages/system/user/profile/oauthIdentity';
import SvgIcon from '@/components/SvgIcon';
import { useSettingsStore } from '@/store/modules/settings';

type ProfileState = {
  user: Partial<UserVO>;
  roleGroup: string;
  postGroup: string;
  devices: OnlineVO[];
};

const initialState: ProfileState = {
  user: {},
  roleGroup: '',
  postGroup: '',
  devices: []
};

export default function ProfilePage() {
  const [state, setState] = useState<ProfileState>(initialState);
  const dark = useSettingsStore((state) => state.dark);
  const {
    token: { colorBorderSecondary, colorText, colorTextHeading }
  } = theme.useToken();

  const profileItems = [
    { icon: 'user', label: '用户名称', value: state.user.userName },
    { icon: 'phone', label: '手机号码', value: state.user.phonenumber },
    { icon: 'email', label: '用户邮箱', value: state.user.email },
    {
      icon: 'tree',
      label: '所属部门',
      value: state.user.deptName ? `${state.user.deptName} / ${state.postGroup || ''}` : ''
    },
    { icon: 'peoples', label: '所属角色', value: state.roleGroup },
    { icon: 'date', label: '创建日期', value: state.user.createTime }
  ];

  const loadProfile = async () => {
    const response = await getUserProfile();
    const profile = assertUserProfileData(response.data);
    setState((prev) => ({
      ...prev,
      user: profile.user,
      roleGroup: profile.roleGroup,
      postGroup: profile.postGroup
    }));
  };

  const loadDevices = async () => {
    const response = await getOnline();
    setState((prev) => ({
      ...prev,
      devices: response.rows
    }));
  };

  useEffect(() => {
    loadProfile();
    loadDevices();
  }, []);

  const listBorderColor = dark ? colorBorderSecondary : '#f0f0f0';
  const listTextColor = dark ? colorText : '#606266';
  const listLabelColor = dark ? colorTextHeading : '#303133';

  return (
    <Row gutter={20}>
      <Col xs={24} lg={6}>
        <Card title="个人信息">
          <div style={{ textAlign: 'center' }}>
            <UserAvatar avatar={state.user.avatar} onUploaded={loadProfile} />
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '16px 0 0',
              borderTop: `1px solid ${listBorderColor}`
            }}
          >
            {profileItems.map((item) => (
              <li
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '10px 0',
                  borderBottom: `1px solid ${listBorderColor}`,
                  fontSize: 14,
                  color: listTextColor
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', color: listLabelColor }}>
                  <SvgIcon iconClass={item.icon} size={14} />
                  {item.label}
                </span>
                <span style={{ textAlign: 'right' }}>{item.value || ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Col>
      <Col xs={24} lg={18}>
        <Card title="基本资料">
          <Tabs
            items={[
              {
                key: 'userinfo',
                label: '基本资料',
                children: <UserInfo user={state.user} onUpdated={loadProfile} />
              },
              {
                key: 'resetPwd',
                label: '修改密码',
                children: <ResetPwd />
              },
              {
                key: 'onlineDevice',
                label: '在线设备',
                children: <OnlineDevice devices={state.devices} onChanged={loadDevices} />
              },
              {
                key: 'oauthIdentity',
                label: '账号关联',
                children: <OauthIdentityPanel />
              }
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}
