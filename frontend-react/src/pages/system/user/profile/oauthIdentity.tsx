import { Button, Card, Empty, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getOAuthProviders } from '@/api/login';
import { getProfileOauthBindAuthorizeUrl, listProfileOauthIdentities, unbindProfileOauthIdentity } from '@/api/system/user';
import type { ProfileOauthIdentityVO } from '@/api/system/user/types';

export default function OauthIdentityPanel() {
  const [identities, setIdentities] = useState<ProfileOauthIdentityVO[]>([]);
  const [providers, setProviders] = useState<Array<{ providerCode: string; providerName: string }>>([]);
  const [bindOpen, setBindOpen] = useState(false);
  const [unbindTarget, setUnbindTarget] = useState<ProfileOauthIdentityVO | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bindForm] = Form.useForm<{ provider: string }>();
  const [unbindForm] = Form.useForm<{ currentPassword?: string }>();

  const loadIdentities = async () => {
    const response = await listProfileOauthIdentities();
    setIdentities(response.data);
  };

  useEffect(() => {
    void loadIdentities();
    void getOAuthProviders().then((response) => setProviders(response.data));
  }, []);

  const handleBind = async () => {
    const { provider } = await bindForm.validateFields(['provider']);
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
    const values = await unbindForm.validateFields(unbindTarget.passwordConfirmationRequired ? ['currentPassword'] : []);
    setSubmitting(true);
    try {
      await unbindProfileOauthIdentity(unbindTarget.identityId, values.currentPassword);
      setUnbindTarget(null);
      unbindForm.resetFields(['currentPassword']);
      await loadIdentities();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Button type="primary" icon={<LinkOutlined />} onClick={() => setBindOpen(true)} disabled={providers.length === 0}>
        绑定第三方账号
      </Button>
      {identities.length === 0 ? (
        <Empty description="尚未绑定第三方账号" />
      ) : (
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          {identities.map((identity) => (
            <Card
              key={identity.identityId}
              size="small"
              title={
                <Space>
                  <Typography.Text>{identity.providerName}</Typography.Text>
                  <Tag color={identity.status === '0' ? 'green' : 'default'}>{identity.status === '0' ? '已绑定' : '已停用'}</Tag>
                </Space>
              }
              extra={
                <Button type="link" danger icon={<DeleteOutlined />} onClick={() => setUnbindTarget(identity)}>
                  解绑
                </Button>
              }
            >
              <Typography.Text type="secondary">
                {identity.lastLoginTime ? `最近登录：${identity.lastLoginTime}` : '尚未使用该身份登录'}
              </Typography.Text>
            </Card>
          ))}
        </Space>
      )}
      <Modal
        forceRender
        title="绑定第三方账号"
        open={bindOpen}
        confirmLoading={submitting}
        onOk={() => void handleBind()}
        onCancel={() => setBindOpen(false)}
      >
        <Form form={bindForm} layout="vertical">
          <Form.Item name="provider" label="第三方平台" rules={[{ required: true, message: '请选择第三方平台' }]}>
            <Select options={providers.map((provider) => ({ label: provider.providerName, value: provider.providerCode }))} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="解绑第三方账号"
        open={Boolean(unbindTarget)}
        forceRender
        confirmLoading={submitting}
        onOk={() => void handleUnbind()}
        onCancel={() => {
          setUnbindTarget(null);
          unbindForm.resetFields(['currentPassword']);
        }}
      >
        <Form form={unbindForm} layout="vertical">
          <Typography.Paragraph>确认解绑 {unbindTarget?.providerName}？</Typography.Paragraph>
          {unbindTarget?.passwordConfirmationRequired && (
            <Form.Item name="currentPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
              <Input.Password autoComplete="current-password" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Space>
  );
}
