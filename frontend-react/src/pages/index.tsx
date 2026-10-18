import { Button, Card, Col, Divider, Row, Typography, theme } from 'antd';
import { useSettingsStore } from '@/store/modules/settings';
import { GithubOutlined, RocketOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

export default function HomePage() {
  const dark = useSettingsStore((state) => state.dark);
  const {
    token: { colorTextSecondary, colorText, colorPrimary, colorBorderSecondary, colorBgLayout }
  } = theme.useToken();

  // 模拟 launch-docs-site.html 中的卡片数据
  const features = [
    {
      title: '色彩基准',
      description: '自动适配 Light/Dark 模式，通过 CSS 变量精准控制。',
      tag: 'UI/UX'
    },
    {
      title: '响应式布局',
      description: '针对桌面端和小程序环境的深度适配。',
      tag: 'Adaptive'
    },
    {
      title: '交互反馈',
      description: '细腻的阴影与过渡动画，增强确定感。',
      tag: 'Interaction'
    }
  ];

  return (
    <div className="app-container" style={{ minHeight: '100%', padding: '24px' }}>
      <Row gutter={[24, 24]}>
        {/* Hero Section */}
        <Col span={24}>
          <div
            style={{
              padding: '40px',
              borderRadius: '12px',
              backgroundImage: dark ? 'linear-gradient(135deg, #1f1f1f 0%, #141414 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f5f7fb 100%)',
              border: `1px solid ${colorBorderSecondary}`,
              overflow: 'hidden',
              position: 'relative',
              boxShadow: dark ? '0 6px 24px rgba(0, 0, 0, 0.3)' : '0 4px 16px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px' }}>
              <Text
                style={{
                  color: colorPrimary,
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  fontSize: '12px',
                  display: 'block',
                  marginBottom: '12px'
                }}
              >
                Cohere Editorial Design
              </Text>
              <Title level={1} style={{ marginTop: 0, marginBottom: '20px', letterSpacing: '0.2px', color: colorText }}>
                infoq-scaffold-backend后台管理系统
              </Title>
              <Paragraph style={{ fontSize: '16px', color: colorTextSecondary, lineHeight: 1.8, marginBottom: '32px' }}>
                基于编辑感设计规范，致力于提供如精品期刊般的扫读与操作体验。 系统原生支持动态主题切换，确保在任何环境下都能提供一致且舒适的交互。
              </Paragraph>
              <div style={{ display: 'flex', gap: '16px' }}>
                <Button type="primary" size="large" icon={<RocketOutlined />} style={{ height: '46px', borderRadius: '8px', paddingInline: '24px' }}>
                  快速开始
                </Button>
                <Button size="large" icon={<GithubOutlined />} style={{ height: '46px', borderRadius: '8px', paddingInline: '24px' }}>
                  查看仓库
                </Button>
              </div>
            </div>
            {/* 装饰性元素 */}
            <div
              style={{
                position: 'absolute',
                top: '-10%',
                right: '-5%',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                background: dark ? 'rgba(64, 158, 255, 0.05)' : 'rgba(64, 158, 255, 0.03)',
                filter: 'blur(60px)',
                pointerEvents: 'none'
              }}
            />
          </div>
        </Col>

        {/* Feature Grid */}
        {features.map((item, index) => (
          <Col xs={24} md={8} key={index}>
            <Card
              hoverable
              style={{ height: '100%', borderRadius: '12px', borderColor: colorBorderSecondary }}
              styles={{ body: { padding: '30px' } }}
            >
              <Text style={{ color: colorTextSecondary, fontSize: '12px', marginBottom: '8px', display: 'block' }}>{item.tag}</Text>
              <Title level={4} style={{ marginTop: 0, marginBottom: '16px', color: colorText }}>
                {item.title}
              </Title>
              <Paragraph style={{ color: colorTextSecondary, marginBottom: 0, lineHeight: 1.6 }}>{item.description}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider style={{ margin: '40px 0', borderColor: colorBorderSecondary }} />

      {/* Bottom Content Area */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title={<span style={{ color: colorText }}>最新动态</span>}
            extra={
              <Button type="link" style={{ color: colorPrimary }}>
                更多
              </Button>
            }
            style={{ height: '100%', borderRadius: '12px', borderColor: colorBorderSecondary }}
          >
            <div
              style={{
                height: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: colorBgLayout,
                borderRadius: '8px'
              }}
            >
              <Paragraph style={{ margin: 0, textAlign: 'center', color: colorTextSecondary }}>数据图表展示区域 (ECharts 可在此集成)</Paragraph>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<span style={{ color: colorText }}>快速导航</span>}
            style={{ height: '100%', borderRadius: '12px', borderColor: colorBorderSecondary }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['后端手册', '管理端配置', '小程序开发', '部署指南'].map((nav) => (
                <Button
                  key={nav}
                  block
                  style={{ textAlign: 'left', height: '40px', borderRadius: '6px', color: colorTextSecondary, borderColor: colorBorderSecondary }}
                >
                  {nav}
                </Button>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
