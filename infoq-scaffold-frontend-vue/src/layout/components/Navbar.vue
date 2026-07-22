<template>
  <div class="navbar">
    <hamburger id="hamburger-container" :is-active="appStore.sidebar.opened" class="hamburger-container" @toggle-click="toggleSideBar" />
    <breadcrumb v-if="!settingsStore.topNav" id="breadcrumb-container" class="breadcrumb-container" />
    <top-nav v-if="settingsStore.topNav" id="topmenu-container" class="topmenu-container" />

    <div class="right-menu flex align-center">
      <template v-if="appStore.device !== 'mobile'">
        <search-menu ref="searchMenuRef" />
        <el-tooltip content="搜索" effect="dark" placement="bottom">
          <div class="right-menu-item hover-effect" @click="openSearchMenu">
            <svg-icon class-name="search-icon" icon-class="search" />
          </div>
        </el-tooltip>
        <!-- 消息 -->
        <el-tooltip :content="proxy.$t('navbar.message')" effect="dark" placement="bottom">
          <div>
            <el-popover placement="bottom" trigger="click" transition="el-zoom-in-top" :width="300" :persistent="false" @show="noticeStore.refresh()">
              <template #reference>
                <el-badge :value="newNotice > 0 ? newNotice : ''" :max="99">
                  <div class="right-menu-item hover-effect" style="display: block"><svg-icon icon-class="message" /></div>
                </el-badge>
              </template>
              <template #default>
                <notice></notice>
              </template>
            </el-popover>
          </div>
        </el-tooltip>
        <el-tooltip content="Github" effect="dark" placement="bottom">
          <info-q-git id="infoQ-git" class="right-menu-item hover-effect" />
        </el-tooltip>

        <el-tooltip :content="proxy.$t('navbar.full')" effect="dark" placement="bottom">
          <screen-full id="screenFull" class="right-menu-item hover-effect" />
        </el-tooltip>

        <el-tooltip :content="proxy.$t('navbar.language')" effect="dark" placement="bottom">
          <lang-select id="lang-select" class="right-menu-item hover-effect" />
        </el-tooltip>

        <el-tooltip :content="proxy.$t('navbar.layoutSize')" effect="dark" placement="bottom">
          <size-select id="size-select" class="right-menu-item hover-effect" />
        </el-tooltip>
      </template>
      <div class="avatar-container">
        <el-dropdown class="right-menu-item hover-effect" trigger="click" @command="handleCommand">
          <div class="avatar-wrapper">
            <img :src="userStore.avatar" class="user-avatar" />
            <el-icon><caret-bottom /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <router-link to="/user/profile">
                <el-dropdown-item>{{ proxy.$t('navbar.personalCenter') }}</el-dropdown-item>
              </router-link>
              <el-dropdown-item v-if="settingsStore.showSettings" command="setLayout">
                <span>{{ proxy.$t('navbar.layoutSetting') }}</span>
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">
                <span>{{ proxy.$t('navbar.logout') }}</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SearchMenu from './TopBar/search.vue';
import { useAppStore } from '@/store/modules/app';
import { useUserStore } from '@/store/modules/user';
import { useSettingsStore } from '@/store/modules/settings';
import { useNoticeStore } from '@/store/modules/notice';
import notice from './notice/index.vue';
import router from '@/router';
import { ElMessageBoxOptions } from 'element-plus/es/components/message-box/src/message-box.type';

const appStore = useAppStore();
const userStore = useUserStore();
const settingsStore = useSettingsStore();
const noticeStore = useNoticeStore();
const newNotice = computed(() => noticeStore.state.unreadCount);

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

// 搜索菜单
const searchMenuRef = ref<InstanceType<typeof SearchMenu>>();

const openSearchMenu = () => {
  searchMenuRef.value?.openSearch();
};

const toggleSideBar = () => {
  appStore.toggleSideBar(false);
};

const logout = async () => {
  await ElMessageBox.confirm('确定注销并退出系统吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  } as ElMessageBoxOptions);
  userStore.logout().then(() => {
    router.replace({
      path: '/login',
      query: {
        redirect: encodeURIComponent(router.currentRoute.value.fullPath || '/')
      }
    });
    proxy?.$tab.closeAllPage();
  });
};

const emits = defineEmits(['setLayout']);
const setLayout = () => {
  emits('setLayout');
};
// 定义Command方法对象 通过key直接调用方法
const commandMap: Record<string, () => void | Promise<void>> = {
  setLayout,
  logout
};
const handleCommand = (command: string) => {
  // 判断是否存在该方法
  if (commandMap[command]) {
    commandMap[command]();
  }
};
onMounted(() => {
  void noticeStore.refresh();
});
</script>

<style lang="scss" scoped>
:deep(.el-select .el-input__wrapper) {
  height: 30px;
}

:deep(.el-badge__content.is-fixed) {
  top: 12px;
}

.flex {
  display: flex;
}

.align-center {
  align-items: center;
}

.navbar {
  height: 50px;
  overflow: hidden;
  position: relative;
  //background: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);

  .hamburger-container {
    line-height: 46px;
    height: 100%;
    float: left;
    cursor: pointer;
    transition: background 0.3s;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      background: rgba(0, 0, 0, 0.025);
    }
  }

  .breadcrumb-container {
    float: left;
  }

  .topmenu-container {
    position: absolute;
    left: 50px;
  }

  .errLog-container {
    display: inline-block;
    vertical-align: top;
  }

  .right-menu {
    float: right;
    height: 100%;
    line-height: 50px;
    display: flex;

    &:focus {
      outline: none;
    }

    .right-menu-item {
      display: inline-block;
      padding: 0 8px;
      height: 100%;
      font-size: 18px;
      color: #5a5e66;
      vertical-align: text-bottom;

      &.hover-effect {
        cursor: pointer;
        transition: background 0.3s;

        &:hover {
          background: rgba(0, 0, 0, 0.025);
        }
      }
    }

    .avatar-container {
      margin-right: 40px;

      .avatar-wrapper {
        margin-top: 5px;
        position: relative;

        .user-avatar {
          cursor: pointer;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          margin-top: 10px;
        }

        i {
          cursor: pointer;
          position: absolute;
          right: -20px;
          top: 25px;
          font-size: 12px;
        }
      }
    }
  }
}
</style>
