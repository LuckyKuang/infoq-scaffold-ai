<template>
  <view class="messages-page">
    <button class="read-all" :disabled="loading" @click="handleReadAll">全部标为已读</button>
    <view v-if="messages.length === 0 && !loading" class="empty">暂无消息</view>
    <view v-for="message in messages" :key="message.messageId" :class="['message-card', { unread: !message.readTime }]">
      <view class="message-main" @click="showDetail(message)">
        <text class="message-title">{{ message.title }}</text>
        <text class="message-time">{{ message.createTime }}</text>
      </view>
      <view class="message-actions">
        <text v-if="!message.readTime" @click="handleRead(message.messageId)">已读</text>
        <text class="danger" @click="handleDelete(message.messageId)">删除</text>
      </view>
    </view>
    <view class="back-profile" @click="navigate(routes.profile)">返回个人中心</view>
  </view>
</template>

<script setup lang="ts">
import {ref} from 'vue';
import {onPullDownRefresh, onShow} from '@dcloudio/uni-app';
import {deleteMessages, listMessages, markAllMessagesRead, markMessageRead, type MessageRecipientVO} from '@/api';
import {navigate, routes} from '@/utils/navigation';
import {handlePageError} from '@/utils/ui';
import {useSessionStore} from '@/store/session';

const messages = ref<MessageRecipientVO[]>([]);
const loading = ref(false);
const sessionStore = useSessionStore();

const loadMessages = async () => {
  loading.value = true;
  try {
    const response = await listMessages();
    messages.value = response.rows;
    await sessionStore.refreshUnreadMessageCount();
  } catch (error) {
    await handlePageError(error, '消息加载失败');
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
};

const showDetail = async (message: MessageRecipientVO) => {
  await uni.showModal({ title: message.title, content: message.content || '暂无正文', showCancel: false });
  if (!message.readTime) {
    await markMessageRead(message.messageId);
    await loadMessages();
  }
};

const handleRead = async (messageId: number) => {
  try {
    await markMessageRead(messageId);
    await loadMessages();
  } catch (error) {
    await handlePageError(error, '消息已读失败');
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
  const modal = await uni.showModal({ title: '确认删除', content: '确定删除这条消息吗？' });
  if (!modal.confirm) return;
  try {
    await deleteMessages([messageId]);
    await loadMessages();
  } catch (error) {
    await handlePageError(error, '消息删除失败');
  }
};

onShow(() => { void loadMessages(); });
onPullDownRefresh(() => { void loadMessages(); });
</script>

<style scoped lang="scss">
.messages-page { min-height: 100vh; padding: 24rpx; background: #f5f7f9; }
.read-all { margin-bottom: 20rpx; color: #fff; background: #1677ff; }
.message-card { display: flex; justify-content: space-between; gap: 18rpx; margin-top: 20rpx; padding: 24rpx; background: #fff; border-left: 6rpx solid transparent; }
.message-card.unread { border-left-color: #1677ff; }
.message-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 10rpx; }
.message-title { font-size: 30rpx; color: #1f2937; }
.message-time { font-size: 24rpx; color: #6b7280; }
.message-actions { display: flex; flex-direction: column; gap: 16rpx; color: #1677ff; font-size: 26rpx; }
.danger { color: #dc2626; }
.empty, .back-profile { padding: 48rpx 0; text-align: center; color: #6b7280; }
</style>
