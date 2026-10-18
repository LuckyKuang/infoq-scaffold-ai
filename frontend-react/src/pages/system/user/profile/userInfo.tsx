import { useEffect } from 'react';
import { Button, Form, Input, Radio, Space } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUserProfile, updateUserProfile } from '@/api/system/user';
import { assertUserProfileData } from '@/api/system/user/guards';
import type { UserVO } from '@/api/system/user/types';
import { useTagsViewStore } from '@/store/modules/tagsView';
import modal from '@/utils/modal';

type UserInfoProps = {
  user?: Partial<UserVO>;
  onUpdated?: () => void;
};

export default function UserInfo({ user, onUpdated }: UserInfoProps) {
  const [form] = Form.useForm<Partial<UserVO>>();
  const location = useLocation();
  const navigate = useNavigate();
  const delView = useTagsViewStore((state) => state.delView);

  useEffect(() => {
    if (user) {
      form.setFieldsValue(user);
      return;
    }
    const loadProfile = async () => {
      const response = await getUserProfile();
      form.setFieldsValue(assertUserProfileData(response.data).user);
    };
    loadProfile();
  }, [form, user]);

  return (
    <Form form={form} layout="vertical">
      <Form.Item label="用户昵称" name="nickName" rules={[{ required: true, message: '用户昵称不能为空' }]}>
        <Input maxLength={30} />
      </Form.Item>
      <Form.Item
        label="手机号码"
        name="phonenumber"
        rules={[
          { required: true, message: '手机号码不能为空' },
          { pattern: /^1[3456789][0-9]\d{8}$/, message: '请输入正确的手机号码' }
        ]}
      >
        <Input maxLength={11} />
      </Form.Item>
      <Form.Item
        label="邮箱"
        name="email"
        rules={[
          { required: true, message: '邮箱地址不能为空' },
          { type: 'email', message: '请输入正确的邮箱地址' }
        ]}
      >
        <Input maxLength={50} />
      </Form.Item>
      <Form.Item label="性别" name="sex">
        <Radio.Group
          options={[
            { label: '男', value: '0' },
            { label: '女', value: '1' }
          ]}
        />
      </Form.Item>
      <Space>
        <Button
          type="primary"
          onClick={async () => {
            const values = await form.validateFields();
            await updateUserProfile(values as never);
            modal.msgSuccess('修改成功');
            onUpdated?.();
          }}
        >
          保存
        </Button>
        <Button
          danger
          onClick={() => {
            delView(location.pathname);
            navigate('/index');
          }}
        >
          关闭
        </Button>
      </Space>
    </Form>
  );
}
