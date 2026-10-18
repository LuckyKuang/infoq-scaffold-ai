<template>
  <div v-loading="state.loading" class="layout-navbars-breadcrumb-user-news">
    <div class="head-box">
      <div class="head-box-title">通知公告</div>
      <div class="head-box-btn" @click="onReadAll">全部已读</div>
    </div>
    <div v-loading="state.loading" class="content-box">
      <template v-if="newsList.length > 0">
        <div v-for="v in newsList" :key="v.messageId" class="content-box-item" @click="onNewsClick(v.messageId)">
          <div class="item-conten">
            <div>{{ v.title }}</div>
            <div class="content-box-msg"></div>
            <div class="content-box-time">{{ v.createTime }}</div>
          </div>
          <!-- 已读/未读 -->
          <span v-if="v.readTime" class="el-tag el-tag--success el-tag--mini read">已读</span>
          <span v-else class="el-tag el-tag--danger el-tag--mini read">未读</span>
        </div>
      </template>
      <el-empty v-else :description="'消息为空'"></el-empty>
    </div>
    <el-button link type="primary" class="all-message-button" @click="router.push('/message-center')">全部消息</el-button>
  </div>
</template>

<script setup lang="ts" name="layoutBreadcrumbUserNews">
import type { NoticeItem } from '@/store/modules/notice';
import { useNoticeStore } from '@/store/modules/notice';
import router from '@/router';

const noticeStore = useNoticeStore();
const state = noticeStore.state;
const newsList = computed<NoticeItem[]>(() => state.notices);

/**
 * 初始化数据
 * @returns
 */
const getTableData = async () => {
  await noticeStore.refresh();
};

const onNewsClick = (messageId: number) => {
  void noticeStore.markRead(messageId);
};

const onReadAll = () => {
  void noticeStore.readAll();
};

onMounted(() => {
  nextTick(() => {
    getTableData();
  });
});
</script>

<style lang="scss" scoped>
.layout-navbars-breadcrumb-user-news {
  .head-box {
    display: flex;
    border-bottom: 1px solid var(--el-border-color-lighter);
    box-sizing: border-box;
    color: var(--el-text-color-primary);
    justify-content: space-between;
    height: 35px;
    align-items: center;
    .head-box-btn {
      color: var(--el-color-primary);
      font-size: 13px;
      cursor: pointer;
      opacity: 0.8;
      &:hover {
        opacity: 1;
      }
    }
  }
  .content-box {
    height: 300px;
    overflow: auto;
    font-size: 13px;
    .content-box-item {
      padding-top: 12px;
      display: flex;
      &:last-of-type {
        padding-bottom: 12px;
      }
      .content-box-msg {
        color: var(--el-text-color-secondary);
        margin-top: 5px;
        margin-bottom: 5px;
      }
      .content-box-time {
        color: var(--el-text-color-secondary);
      }
      .item-conten {
        width: 100%;
        display: flex;
        flex-direction: column;
      }
    }
  }
  :deep(.el-empty__description p) {
    font-size: 13px;
  }
  .all-message-button {
    width: 100%;
  }
}
</style>
