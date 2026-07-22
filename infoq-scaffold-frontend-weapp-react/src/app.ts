import type {PropsWithChildren} from 'react';
import {useDidShow, useLaunch} from '@tarojs/taro';
import {useSessionStore} from '@/store/session';
import './styles/taro-ui.css';
import './app.scss';

function App({ children }: PropsWithChildren) {
  const refreshUnreadMessageCount = () => void useSessionStore.getState().refreshUnreadMessageCount().catch(() => undefined);

  useLaunch(refreshUnreadMessageCount);
  useDidShow(refreshUnreadMessageCount);

  return children;
}

export default App;
