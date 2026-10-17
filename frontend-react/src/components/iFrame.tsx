import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from 'antd';

type IFrameProps = {
  src: string;
  iframeId?: string;
};

export default function IFrame({ src, iframeId = 'iframe-view' }: IFrameProps) {
  const [height, setHeight] = useState(() => `${document.documentElement.clientHeight - 94.5}px`);
  const [loading, setLoading] = useState(true);
  const targetUrl = useMemo(() => src, [src]);

  useEffect(() => {
    const onResize = () => {
      setHeight(`${document.documentElement.clientHeight - 94.5}px`);
    };
    window.addEventListener('resize', onResize);
    const timer = window.setTimeout(() => setLoading(false), 300);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div style={{ height }}>
      {loading && <Skeleton active paragraph={{ rows: 6 }} />}
      <iframe id={iframeId} src={targetUrl} style={{ width: '100%', height: '100%', border: 0, display: loading ? 'none' : 'block' }} />
    </div>
  );
}
