<template>
  <div class="app-container home-wrapper">
    <el-row :gutter="24">
      <!-- Hero Section -->
      <el-col :span="24">
        <el-card class="panel hero-card" shadow="never">
          <div class="hero-content">
            <span class="eyebrow" :style="{ color: theme }"> Cohere Editorial Design </span>
            <h1 class="hero-title">infoq-scaffold-backend后台管理系统</h1>
            <p class="hero-desc">
              基于编辑感设计规范，致力于提供如精品期刊般的扫读与操作体验。 系统原生支持动态主题切换，确保在任何环境下都能提供一致且舒适的交互。
            </p>
            <div class="hero-actions">
              <el-button type="primary" size="large" class="action-btn" :icon="Promotion">快速开始</el-button>
              <el-button size="large" class="action-btn" :icon="Position">查看仓库</el-button>
            </div>
          </div>
          <!-- Decorative Blur Element -->
          <div class="hero-blur-decor" :class="{ dark: isDark }"></div>
        </el-card>
      </el-col>

      <!-- Feature Grid -->
      <el-col :xs="24" :md="8" v-for="(item, index) in features" :key="index">
        <el-card class="panel feature-card" shadow="hover">
          <div class="feature-tag">{{ item.tag }}</div>
          <h3 class="feature-title">{{ item.title }}</h3>
          <p class="feature-desc">{{ item.description }}</p>
        </el-card>
      </el-col>
    </el-row>

    <el-divider class="section-divider" />

    <!-- Bottom Content Area -->
    <el-row :gutter="24">
      <el-col :xs="24" :lg="16">
        <el-card class="panel section-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>最新动态</span>
              <el-button type="primary" link>更多</el-button>
            </div>
          </template>
          <div class="chart-placeholder">
            <p>数据图表展示区域 (ECharts 可在此集成)</p>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="8">
        <el-card class="panel section-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>快速导航</span>
            </div>
          </template>
          <div class="nav-links">
            <el-button v-for="nav in ['后端手册', '管理端配置', '小程序开发', '部署指南']" :key="nav" class="nav-btn" plain>
              {{ nav }}
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts" name="Index">
import { computed } from 'vue';
import { useSettingsStore } from '@/store/modules/settings';
import { Promotion, Position } from '@element-plus/icons-vue';

const settingsStore = useSettingsStore();
const isDark = computed(() => settingsStore.dark);
const theme = computed(() => settingsStore.theme);

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
</script>

<style lang="scss" scoped>
.home-wrapper {
  min-height: 100%;
  padding: 24px;
}

.hero-card {
  position: relative;
  overflow: hidden;
  padding: 20px;
  border: none;
  background-image: linear-gradient(135deg, #ffffff 0%, #f5f7fb 100%);

  :deep(.el-card__body) {
    position: relative;
    z-index: 1;
  }

  .hero-content {
    max-width: 800px;
  }

  .eyebrow {
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 12px;
    display: block;
    margin-bottom: 12px;
  }

  .hero-title {
    margin-top: 0;
    margin-bottom: 20px;
    letter-spacing: 0.2px;
    font-size: 32px;
    font-weight: 700;
    color: var(--el-text-color-primary);
  }

  .hero-desc {
    font-size: 16px;
    color: var(--el-text-color-secondary);
    line-height: 1.8;
    margin-bottom: 32px;
  }

  .hero-actions {
    display: flex;
    gap: 16px;

    .action-btn {
      height: 46px;
      border-radius: 8px;
      padding: 0 24px;
    }
  }

  .hero-blur-decor {
    position: absolute;
    top: -10%;
    right: -5%;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: rgba(64, 158, 255, 0.03);
    filter: blur(60px);
    pointer-events: none;

    &.dark {
      background: rgba(64, 158, 255, 0.05);
    }
  }
}

html.dark .hero-card {
  background-image: linear-gradient(135deg, #1f1f1f 0%, #141414 100%);
}

.feature-card {
  height: 100%;

  :deep(.el-card__body) {
    padding: 30px;
  }

  .feature-tag {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 8px;
  }

  .feature-title {
    margin-top: 0;
    margin-bottom: 16px;
    font-size: 20px;
    color: var(--el-text-color-primary);
  }

  .feature-desc {
    color: var(--el-text-color-secondary);
    margin-bottom: 0;
    line-height: 1.6;
  }
}

.section-divider {
  margin: 40px 0;
}

.section-card {
  height: 100%;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }

  .chart-placeholder {
    height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--el-fill-color-light);
    border-radius: 8px;

    p {
      color: var(--el-text-color-secondary);
    }
  }

  .nav-links {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .nav-btn {
      margin-left: 0 !important;
      text-align: left;
      height: 40px;
      border-radius: 6px;
      justify-content: flex-start;
    }
  }
}
</style>
