import {Text, View} from '@tarojs/components';
import Taro, {useDidShow, usePullDownRefresh} from '@tarojs/taro';
import {useState} from 'react';
import {AtButton} from 'taro-ui';
import {deleteMessages, listMessages, markAllMessagesRead, markMessageRead, type MessageRecipientVO} from '@/api';
import {routes} from '@/utils/navigation';
import {handlePageError} from '@/utils/ui';
import {useSessionStore} from '@/store/session';
import './index.scss';

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageRecipientVO[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshUnreadMessageCount = useSessionStore((state) => state.refreshUnreadMessageCount);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await listMessages();
      setMessages(response.rows);
      await refreshUnreadMessageCount();
    } catch (error) {
      await handlePageError(error, '消息加载失败');
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };

  useDidShow(() => { void loadMessages(); });
  usePullDownRefresh(() => { void loadMessages(); });

  const showDetail = async (message: MessageRecipientVO) => {
    await Taro.showModal({ title: message.title, content: message.content || '暂无正文', showCancel: false });
    if (!message.readTime) {
      await markMessageRead(message.messageId);
      await loadMessages();
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllMessagesRead();
      await loadMessages();
    } catch (error) {
      await handlePageError(error, '全部已读失败');
    }
  };

  const handleDelete = async (messageId: number) => {
    const modal = await Taro.showModal({ title: '确认删除', content: '确定删除这条消息吗？' });
    if (!modal.confirm) return;
    try {
      await deleteMessages([messageId]);
      await loadMessages();
    } catch (error) {
      await handlePageError(error, '消息删除失败');
    }
  };

  return (
    <View className="messages-page">
      <AtButton loading={loading} type="primary" onClick={() => void handleReadAll()}>全部标为已读</AtButton>
      {messages.length === 0 && !loading && <View className="empty">暂无消息</View>}
      {messages.map((message) => (
        <View key={message.messageId} className={`message-card ${message.readTime ? '' : 'unread'}`}>
          <View className="message-main" onClick={() => void showDetail(message)}>
            <Text className="message-title">{message.title}</Text>
            <Text className="message-time">{message.createTime}</Text>
          </View>
          <View className="message-actions">
            {!message.readTime && <Text onClick={() => void markMessageRead(message.messageId).then(loadMessages)}>已读</Text>}
            <Text className="danger" onClick={() => void handleDelete(message.messageId)}>删除</Text>
          </View>
        </View>
      ))}
      <View className="back-profile" onClick={() => Taro.navigateTo({ url: routes.profile })}>返回个人中心</View>
    </View>
  );
}
