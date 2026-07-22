<template>
  <div class="app-container">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>消息中心</span>
          <el-button type="primary" icon="Check" @click="handleReadAll">全部标为已读</el-button>
        </div>
      </template>
      <el-empty v-if="!state.loading && state.notices.length === 0" description="暂无消息" />
      <el-scrollbar v-else max-height="680px">
        <div v-for="message in state.notices" :key="message.messageId" class="message-row">
          <div class="message-content">
            <div class="message-title">
              <span :class="{ unread: !message.readTime }">{{ message.title }}</span>
              <el-tag size="small" :type="levelType(message.messageLevel)">{{ message.messageLevel }}</el-tag>
            </div>
            <div class="message-body">{{ message.content || '' }}</div>
            <div class="message-time">{{ message.createTime }}</div>
          </div>
          <div class="message-actions">
            <el-button v-if="!message.readTime" link type="primary" @click="handleRead(message.messageId)">标为已读</el-button>
            <el-popconfirm title="确认删除这条消息？" @confirm="handleDelete(message.messageId)">
              <template #reference><el-button link type="danger" icon="Delete" aria-label="删除消息" /></template>
            </el-popconfirm>
          </div>
        </div>
      </el-scrollbar>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useNoticeStore } from '@/store/modules/notice';

const noticeStore = useNoticeStore();
const state = noticeStore.state;

const levelType = (level: string) =>
  ({
    info: 'primary',
    success: 'success',
    warning: 'warning',
    error: 'danger'
  })[level] || 'info';

const handleRead = (messageId: number) => {
  void noticeStore.markRead(messageId);
};

const handleReadAll = () => {
  void noticeStore.readAll();
};

const handleDelete = (messageId: number) => {
  void noticeStore.deleteByIds([messageId]);
};

onMounted(() => {
  void noticeStore.refresh(100);
});
</script>

<style scoped lang="scss">
.card-header,
.message-title,
.message-row,
.message-actions {
  display: flex;
  align-items: center;
}
.card-header,
.message-row {
  justify-content: space-between;
}
.message-row {
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.message-content {
  min-width: 0;
  flex: 1;
}
.message-title {
  gap: 8px;
}
.unread {
  font-weight: 600;
}
.message-body {
  white-space: pre-wrap;
  margin: 8px 0;
  color: var(--el-text-color-regular);
}
.message-time {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.message-actions {
  flex: 0 0 auto;
}
</style>
