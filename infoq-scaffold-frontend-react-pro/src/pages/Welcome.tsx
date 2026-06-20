import {PageContainer} from '@ant-design/pro-components';
import {Card, Col, Row, Statistic, Typography} from 'antd';
import React from 'react';

import './Welcome.css';

const migrationCards = [
  {
    title: '正式并行',
    description:
      '基于 Ant Design Pro / Umi Max 提供正式 React Pro 管理端，与 React、Vue 管理端并行维护。',
  },
  {
    title: '接口边界',
    description:
      '继续复用登录、动态菜单、权限、请求和核心 CRUD 接口，不修改后端 API 契约。',
  },
  {
    title: '验证方式',
    description:
      '通过测试、lint、build 和运行态 smoke 验证 React Pro 主流程。',
  },
] as const;

const Welcome: React.FC = () => {
  return (
    <PageContainer title="React Admin Ant Design Pro">
      <Card className="welcome-summary">
        <Typography.Title level={3}>React Pro 管理端已启用</Typography.Title>
        <Typography.Paragraph type="secondary">
          当前目录是基于 Ant Design Pro 的正式 React Pro 管理端，和旧
          React 管理端、Vue 管理端并行保留，共用同一套后端菜单与权限真值。
        </Typography.Paragraph>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Statistic title="项目定位" value="正式并行" />
          </Col>
          <Col xs={24} md={8}>
            <Statistic title="默认端口" value="80" />
          </Col>
          <Col xs={24} md={8}>
            <Statistic title="路由真值" value="后端菜单" />
          </Col>
        </Row>
      </Card>
      <Row gutter={[16, 16]} className="welcome-card-grid">
        {migrationCards.map((item) => (
          <Col key={item.title} xs={24} md={8}>
            <Card title={item.title} className="welcome-card">
              {item.description}
            </Card>
          </Col>
        ))}
      </Row>
    </PageContainer>
  );
};

export default Welcome;
