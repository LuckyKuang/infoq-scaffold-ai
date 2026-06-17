import { PageContainer } from '@ant-design/pro-components';
import { Card, Col, Row, Statistic, Typography } from 'antd';
import React from 'react';

import './Welcome.css';

const migrationCards = [
  {
    title: '候选项目',
    description:
      '基于 Ant Design Pro / Umi Max 建立迁移工作区，旧 React admin 继续作为行为基线。',
  },
  {
    title: '迁移边界',
    description:
      '优先迁移登录、动态菜单、权限、请求和核心 CRUD，不修改后端 API 契约。',
  },
  {
    title: '验收方式',
    description:
      '每个阶段通过测试、lint、build 和旧项目对照验证后，再进入最终目录切换。',
  },
] as const;

const Welcome: React.FC = () => {
  return (
    <PageContainer title="React Admin Ant Design Pro 候选项目">
      <Card className="welcome-summary">
        <Typography.Title level={3}>对照迁移工作区已建立</Typography.Title>
        <Typography.Paragraph type="secondary">
          当前目录用于验证 Ant Design Pro 工程基线、逐步迁移旧 React admin
          的基础设施与业务页面，并在完整验收后整体切换为正式 React 管理端。
        </Typography.Paragraph>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Statistic title="迁移模式" value="新建对照" />
          </Col>
          <Col xs={24} md={8}>
            <Statistic title="当前阶段" value="Phase 1" />
          </Col>
          <Col xs={24} md={8}>
            <Statistic title="最终目标" value="整体切换" />
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
