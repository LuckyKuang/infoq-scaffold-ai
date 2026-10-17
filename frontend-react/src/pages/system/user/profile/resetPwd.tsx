import { Button, Form, Input, Space } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { updateUserPwd } from '@/api/system/user';
import type { ResetPwdForm } from '@/api/system/user/types';
import { useTagsViewStore } from '@/store/modules/tagsView';
import modal from '@/utils/modal';

const initialValues: ResetPwdForm = {
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
};

export default function ResetPwd() {
  const [form] = Form.useForm<ResetPwdForm>();
  const location = useLocation();
  const navigate = useNavigate();
  const delView = useTagsViewStore((state) => state.delView);

  return (
    <Form form={form} initialValues={initialValues} labelCol={{ flex: '80px' }} style={{ maxWidth: 480 }}>
      <Form.Item label="旧密码" name="oldPassword" rules={[{ required: true, message: '旧密码不能为空' }]}>
        <Input.Password autoComplete="current-password" placeholder="请输入旧密码" />
      </Form.Item>
      <Form.Item
        label="新密码"
        name="newPassword"
        rules={[
          { required: true, message: '新密码不能为空' },
          { min: 6, max: 20, message: '长度在 6 到 20 个字符' },
          { pattern: /^[^<>"'|\\]+$/, message: '不能包含非法字符：< > " \' \\ |' }
        ]}
      >
        <Input.Password autoComplete="new-password" placeholder="请输入新密码" />
      </Form.Item>
      <Form.Item
        label="确认密码"
        name="confirmPassword"
        dependencies={['newPassword']}
        rules={[
          { required: true, message: '确认密码不能为空' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('newPassword') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('两次输入的密码不一致'));
            }
          })
        ]}
      >
        <Input.Password autoComplete="new-password" placeholder="请确认新密码" />
      </Form.Item>
      <Space>
        <Button
          type="primary"
          onClick={async () => {
            const values = await form.validateFields();
            await updateUserPwd(values.oldPassword, values.newPassword);
            modal.msgSuccess('修改成功');
            form.resetFields();
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
