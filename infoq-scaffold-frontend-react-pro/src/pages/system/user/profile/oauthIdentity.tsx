import {DeleteOutlined, LinkOutlined} from '@ant-design/icons';
import {Button, Empty, Form, Input, List, Modal, Select, Space, Tag, Typography} from 'antd';
import {useEffect, useState} from 'react';
import {getOAuthProviders} from '@/api/login';
import {
  getProfileOauthBindAuthorizeUrl,
  listProfileOauthIdentities,
  unbindProfileOauthIdentity,
} from '@/api/system/user';
import type {ProfileOauthIdentityVO} from '@/api/system/user/types';

export default function OauthIdentityPanel() {
  const [identities, setIdentities] = useState<ProfileOauthIdentityVO[]>([]);
  const [providers, setProviders] = useState<Array<{ providerCode: string; providerName: string }>>([]);
  const [bindOpen, setBindOpen] = useState(false);
  const [unbindTarget, setUnbindTarget] = useState<ProfileOauthIdentityVO | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<{ provider: string; currentPassword?: string }>();

  const loadIdentities = async () => {
    const response = await listProfileOauthIdentities();
    setIdentities(response.data);
  };

  useEffect(() => {
    void loadIdentities();
    void getOAuthProviders().then((response) => setProviders(response.data));
  }, []);

  const handleBind = async () => {
    const { provider } = await form.validateFields(['provider']);
    setSubmitting(true);
    try {
      const response = await getProfileOauthBindAuthorizeUrl(provider, `${window.location.origin}/user/profile`);
      window.location.assign(response.data);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnbind = async () => {
    if (!unbindTarget) return;
    const values = await form.validateFields(unbindTarget.passwordConfirmationRequired ? ['currentPassword'] : []);
    setSubmitting(true);
    try {
      await unbindProfileOauthIdentity(unbindTarget.identityId, values.currentPassword);
      setUnbindTarget(null);
      form.resetFields(['currentPassword']);
      await loadIdentities();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Button type="primary" icon={<LinkOutlined />} onClick={() => setBindOpen(true)} disabled={providers.length === 0}>
        绑定第三方账号
      </Button>
      {identities.length === 0 ? <Empty description="尚未绑定第三方账号" /> : (
        <List
          size="small"
          dataSource={identities}
          renderItem={(identity) => (
            <List.Item
              actions={[
                <Button key="unbind" type="link" danger icon={<DeleteOutlined />} onClick={() => setUnbindTarget(identity)}>解绑</Button>,
              ]}
            >
              <List.Item.Meta
                title={<Space><Typography.Text>{identity.providerName}</Typography.Text><Tag color={identity.status === '0' ? 'green' : 'default'}>{identity.status === '0' ? '已绑定' : '已停用'}</Tag></Space>}
                description={identity.lastLoginTime ? `最近登录：${identity.lastLoginTime}` : '尚未使用该身份登录'}
              />
            </List.Item>
          )}
        />
      )}
      <Modal title="绑定第三方账号" open={bindOpen} confirmLoading={submitting} onOk={() => void handleBind()} onCancel={() => setBindOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="provider" label="第三方平台" rules={[{ required: true, message: '请选择第三方平台' }]}>
            <Select options={providers.map((provider) => ({ label: provider.providerName, value: provider.providerCode }))} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="解绑第三方账号"
        open={Boolean(unbindTarget)}
        confirmLoading={submitting}
        onOk={() => void handleUnbind()}
        onCancel={() => { setUnbindTarget(null); form.resetFields(['currentPassword']); }}
      >
        <Typography.Paragraph>确认解绑 {unbindTarget?.providerName}？</Typography.Paragraph>
        {unbindTarget?.passwordConfirmationRequired && (
          <Form form={form} layout="vertical">
            <Form.Item name="currentPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
              <Input.Password autoComplete="current-password" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Space>
  );
}
