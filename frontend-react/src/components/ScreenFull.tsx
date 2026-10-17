import { useEffect, useState } from 'react';
import { Button, Tooltip } from 'antd';
import SvgIcon from '@/components/SvgIcon';

export default function ScreenFull() {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);

  const toggle = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  };

  return (
    <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
      <Button type="text" icon={<SvgIcon iconClass={isFullscreen ? 'exit-fullscreen' : 'fullscreen'} size={18} />} onClick={toggle} />
    </Tooltip>
  );
}
