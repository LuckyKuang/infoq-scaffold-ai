<template>
  <view class="profile-container">
    <view class="profile-banner">
      <view class="header-actions">
        <view class="action-chip" @click="handleUpdatePassword">
          <AppIcon name="settings" size="28" color="rgba(255,255,255,0.9)" />
          <text style="margin-left: 8rpx">修改密码</text>
        </view>
      </view>

      <view class="avatar-outer">
        <view class="avatar-inner">
          <image :src="avatarImage" class="avatar-img" mode="aspectFill" @error="handleAvatarLoadError" />
        </view>
      </view>

      <view class="user-meta">
        <view class="nickname">{{ profile.nickName || profile.userName || '用户' }}</view>
        <view class="username-badge">
          <text>ID: {{ profile.userName || '---' }}</text>
        </view>
      </view>

      <view class="tag-cloud">
        <view v-if="profile.deptName" class="role-tag">{{ profile.deptName }}</view>
        <view v-if="profile.roleGroup" class="role-tag">{{ profile.roleGroup }}</view>
        <view v-if="profile.postGroup" class="role-tag">{{ profile.postGroup }}</view>
      </view>
    </view>

    <view class="profile-content-wrapper">
      <view class="info-group">
        <view class="group-header">
          <text class="title">基本信息</text>
          <view class="edit-link" @click="navigate(routes.profileEdit)">
            <AppIcon name="user" size="28" color="#1677ff" />
            <text style="margin-left: 8rpx">编辑资料</text>
          </view>
        </view>
        <view class="info-list">
          <view class="info-row">
            <text class="label">性别</text>
            <text class="value">{{ getDictLabel(sexOptions, profile.sex) || '保密' }}</text>
          </view>
          <view class="info-row">
            <text class="label">手机号码</text>
            <text class="value">{{ profile.phonenumber || '未绑定' }}</text>
          </view>
          <view class="info-row">
            <text class="label">电子邮箱</text>
            <text class="value">{{ profile.email || '未设置' }}</text>
          </view>
          <view class="info-row">
            <text class="label">微信小程序</text>
            <text class="value">{{ wechatBound ? '已绑定' : '未绑定' }}</text>
          </view>
          <view class="info-row" @click="navigate(routes.messages)">
            <text class="label">消息中心</text>
            <text class="value">{{ sessionStore.unreadMessageCount > 0 ? `${sessionStore.unreadMessageCount} 条未读` : '暂无未读' }}</text>
          </view>
        </view>
      </view>

      <view class="logout-area">
        <view class="logout-btn-modern" @click="handleLogout">退出当前账号</view>
      </view>
    </view>

    <!-- Modern Password Modal -->
    <view class="pwd-modal-overlay" v-if="pwdModalVisible" @click.self="pwdModalVisible = false">
      <view class="modal-card">
        <view class="modal-title">修改安全密码</view>
        <view class="modal-form">
          <view class="modal-input-group">
            <text class="label">原密码</text>
            <input class="modal-input" type="password" v-model="pwdForm.oldPassword" placeholder="请输入原密码" />
          </view>
          <view class="modal-input-group">
            <text class="label">新密码</text>
            <input class="modal-input" type="password" v-model="pwdForm.newPassword" placeholder="6-20位新密码" />
          </view>
          <view class="modal-input-group">
            <text class="label">确认新密码</text>
            <input class="modal-input" type="password" v-model="pwdForm.confirmPassword" placeholder="请再次输入" />
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn primary" @click="handleConfirmUpdatePwd">确认修改</view>
          <view class="modal-btn secondary" @click="pwdModalVisible = false">取消</view>
        </view>
      </view>
    </view>

    <BottomNav active="profile" />
  </view>
</template>

<script setup lang="ts">
import {computed, reactive, ref, watch} from 'vue';
import {onShow} from '@dcloudio/uni-app';
import BottomNav from '@/components/BottomNav.vue';
import AppIcon from '@/components/AppIcon.vue';
import defaultAvatar from '@/assets/images/profile.jpg';
import {
  type DictOption,
  getDictLabel,
  getDicts,
  getUnreadMessageCount,
  getUserProfile,
  listProfileOauthIdentities,
  toDictOptions,
  updateUserPwd
} from '@/api';
import {ensureAuthenticated} from '@/composables/use-auth-guard';
import {navigate, relaunch, routes} from '@/utils/navigation';
import {resolveAvatarUrl} from '@/utils/avatar';
import {handlePageError, showSuccess} from '@/utils/ui';
import {useSessionStore} from '@/store/session';

const sessionStore = useSessionStore();
const wechatBound = ref(false);
const sexOptions = ref<DictOption[]>([]);
const profile = reactive({
  userName: '',
  nickName: '',
  deptName: '',
  phonenumber: '',
  email: '',
  sex: '',
  roleGroup: '',
  postGroup: '',
  status: '',
  avatar: ''
});

const pwdModalVisible = ref(false);
const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const avatarLoadFailed = ref(false);
watch(
  () => profile.avatar,
  () => {
    avatarLoadFailed.value = false;
  }
);

const avatarImage = computed(() => {
  if (avatarLoadFailed.value) {
    return defaultAvatar;
  }
  return resolveAvatarUrl(profile.avatar) || defaultAvatar;
});

const handleAvatarLoadError = () => {
  avatarLoadFailed.value = true;
};

const loadPage = async () => {
  if (!ensureAuthenticated()) {
    return;
  }
  try {
    const session = await sessionStore.loadSession(true);
    if (!session) {
      relaunch(routes.login);
      return;
    }
    const [profileResponse, sexResponse, identityResponse, unreadResponse] = await Promise.all([
      getUserProfile(),
      getDicts('sys_user_sex'),
      listProfileOauthIdentities(),
      getUnreadMessageCount()
    ]);
    const remoteProfile = profileResponse.data;
    sexOptions.value = toDictOptions(sexResponse.data);
    Object.assign(profile, remoteProfile.user);
    profile.deptName = remoteProfile.user?.deptName || session.user.deptName || '';
    profile.roleGroup = remoteProfile.roleGroup || '';
    profile.postGroup = remoteProfile.postGroup || '';
    wechatBound.value = identityResponse.data.some((identity) => identity.providerCode === 'wechat_miniapp' && identity.status === '0');
    sessionStore.unreadMessageCount = unreadResponse.data;
  } catch (error) {
    await handlePageError(error, '个人中心加载失败');
  }
};

const handleUpdatePassword = () => {
  pwdForm.oldPassword = '';
  pwdForm.newPassword = '';
  pwdForm.confirmPassword = '';
  pwdModalVisible.value = true;
};

const handleConfirmUpdatePwd = async () => {
  if (!pwdForm.oldPassword) {
    await uni.showToast({ title: '请输入原密码', icon: 'none' });
    return;
  }
  if (!pwdForm.newPassword) {
    await uni.showToast({ title: '请输入新密码', icon: 'none' });
    return;
  }
  if (pwdForm.newPassword.length < 6 || pwdForm.newPassword.length > 20) {
    await uni.showToast({ title: '新密码长度应在 6 到 20 个字符', icon: 'none' });
    return;
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    await uni.showToast({ title: '两次输入的密码不一致', icon: 'none' });
    return;
  }

  try {
    await updateUserPwd(pwdForm.oldPassword, pwdForm.newPassword);
    pwdModalVisible.value = false;
    await showSuccess('修改成功');
  } catch (error) {
    await handlePageError(error, '密码修改失败');
  }
};

const handleLogout = async () => {
  const res = await uni.showModal({
    title: '退出登录',
    content: '确定退出当前账号吗？',
    confirmColor: '#ef4444'
  });
  if (!res.confirm) return;

  try {
    await sessionStore.signOut();
    relaunch(routes.login);
  } catch (error) {
    await handlePageError(error, '退出失败');
  }
};

onShow(() => {
  void loadPage();
});
</script>

<style lang="scss">
@import './index.scss';
</style>
