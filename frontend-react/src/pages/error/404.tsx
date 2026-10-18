import { Link } from 'react-router-dom';
import parent404 from '@/assets/404_images/404.png';
import cloud404 from '@/assets/404_images/404_cloud.png';
import '@/pages/error/error-pages.css';

export default function Error404Page() {
  return (
    <div className="error-404-container">
      <div className="error-404-pic">
        <img className="error-404-parent" src={parent404} alt="404" />
        <img className="error-404-cloud error-404-cloud-left" src={cloud404} alt="" aria-hidden="true" />
        <img className="error-404-cloud error-404-cloud-mid" src={cloud404} alt="" aria-hidden="true" />
        <img className="error-404-cloud error-404-cloud-right" src={cloud404} alt="" aria-hidden="true" />
      </div>
      <div className="error-404-copy">
        <div className="error-404-oops">404错误!</div>
        <div className="error-404-headline">找不到网页！</div>
        <div className="error-404-info">
          对不起，您正在寻找的页面不存在。尝试检查URL的错误，然后按浏览器上的刷新按钮或尝试在我们的应用程序中找到其他内容。
        </div>
        <Link className="error-404-home" to="/index">
          返回首页
        </Link>
      </div>
    </div>
  );
}
