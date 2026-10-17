import { Button, Col, Row } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import errGif from '@/assets/401_images/401.gif';
import '@/pages/error/error-pages.css';

export default function Error401Page() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleBack = () => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('noGoBack')) {
      navigate('/index', { replace: true });
      return;
    }
    navigate(-1);
  };

  return (
    <div className="error-401-container">
      <Button className="error-401-back" icon={<ArrowLeftOutlined />} onClick={handleBack}>
        返回
      </Button>
      <Row gutter={[32, 32]} style={{ marginTop: 24, alignItems: 'center' }}>
        <Col xs={24} md={12}>
          <h1 className="error-401-title">401错误!</h1>
          <h2 className="error-401-subtitle">您没有访问权限！</h2>
          <p className="error-401-desc">对不起，您没有访问权限，请不要进行非法操作！您可以返回主页面</p>
          <div className="error-401-links">
            <Link to="/index">回首页</Link>
          </div>
        </Col>
        <Col xs={24} md={12}>
          <img className="error-401-gif" src={errGif} alt="Unauthorized" />
        </Col>
      </Row>
    </div>
  );
}
