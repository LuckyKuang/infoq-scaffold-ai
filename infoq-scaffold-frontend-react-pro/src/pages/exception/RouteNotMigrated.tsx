import { PageContainer } from '@ant-design/pro-components';
import { Alert, Typography } from 'antd';

type RouteNotMigratedProps = {
  componentName?: string;
  path: string;
};

export default function RouteNotMigrated({
  componentName,
  path,
}: RouteNotMigratedProps) {
  return (
    <PageContainer title="页面待迁移">
      <Alert
        type="warning"
        showIcon
        message="后端菜单已接入，但该业务页面尚未迁移到 Pro 候选项目。"
        description={
          <Typography.Text code>{componentName || path}</Typography.Text>
        }
      />
    </PageContainer>
  );
}
