import {Text, View} from '@tarojs/components';
import Taro, {useDidShow} from '@tarojs/taro';
import {AtAvatar, AtButton, AtInput, AtModal, AtModalContent, AtModalHeader} from 'taro-ui';
import {
  type DictOption,
  getDictLabel,
  getDicts,
  getUnreadMessageCount,
  getUserProfile,
  listProfileOauthIdentities,
  mobileEnv,
  toDictOptions,
  updateUserPwd
} from '@/api';
import defaultAvatar from '@/assets/images/profile.jpg';
import {useState} from 'react';
import BottomNav from '../../components/bottom-nav';
import {resolveAvatarUrl} from '../../utils/avatar';
import {navigate, relaunch, routes} from '../../utils/navigation';
import {handlePageError} from '../../utils/ui';
import {useSessionStore} from '../../store/session';
import './index.scss';

const getDisplayName = (userName?: string, nickName?: string) => (nickName || userName || '用户').slice(0, 1).toUpperCase();

type ProfileSummary = {
  avatar?: string;
  deptName?: string;
  email?: string;
  nickName?: string;
  phonenumber?: string;
  postGroup?: string;
  roleGroup?: string;
  sex?: string;
  status?: string;
  userName?: string;
};

export default function ProfilePage() {
  const loadSession = useSessionStore((state) => state.loadSession);
  const signOut = useSessionStore((state) => state.signOut);
  const unreadMessageCount = useSessionStore((state) => state.unreadMessageCount);
  const [sexOptions, setSexOptions] = useState<DictOption[]>([]);
  const [profile, setProfile] = useState<ProfileSummary>({
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

  const [pwdModalVisible, setPwdModalVisible] = useState(false);
  const [wechatBound, setWechatBound] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const avatarImage = resolveAvatarUrl(profile.avatar) || defaultAvatar;

  useDidShow(() => {
    const run = async () => {
      try {
        const session = await loadSession(true);
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
        setSexOptions(toDictOptions(sexResponse.data));
        setProfile({
          ...remoteProfile.user,
          deptName: remoteProfile.user?.deptName || session.user.deptName || '',
          roleGroup: remoteProfile.roleGroup || '',
          postGroup: remoteProfile.postGroup || ''
        });
        setWechatBound(identityResponse.data.some((identity) => identity.providerCode === 'wechat_miniapp' && identity.status === '0'));
        useSessionStore.setState({ unreadMessageCount: unreadResponse.data });
      } catch (error) {
        await handlePageError(error, '个人中心加载失败');
      }
    };
    void run();
  });

  const handleUpdatePassword = () => {
    setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setPwdModalVisible(true);
  };

  const handleConfirmUpdatePwd = async () => {
    if (!pwdForm.oldPassword) {
      await Taro.showToast({ title: '请输入原密码', icon: 'none' });
      return;
    }
    if (!pwdForm.newPassword) {
      await Taro.showToast({ title: '请输入新密码', icon: 'none' });
      return;
    }
    if (pwdForm.newPassword.length < 6 || pwdForm.newPassword.length > 20) {
      await Taro.showToast({ title: '新密码长度应在 6 到 20 个字符', icon: 'none' });
      return;
    }
    if (/[<>"'|\\]/.test(pwdForm.newPassword)) {
      await Taro.showToast({ title: '不能包含非法字符：< > " \' \\ |', icon: 'none' });
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      await Taro.showToast({ title: '两次输入的密码不一致', icon: 'none' });
      return;
    }

    try {
      await updateUserPwd(pwdForm.oldPassword, pwdForm.newPassword);
      setPwdModalVisible(false);
      await Taro.showToast({ title: '修改成功', icon: 'success' });
    } catch (error) {
      await handlePageError(error, '密码修改失败');
    }
  };

  const handleLogout = async () => {
    const modal = await Taro.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？'
    });
    if (!modal.confirm) {
      return;
    }
    try {
      await signOut();
      await Taro.showToast({ title: '已退出登录', icon: 'success' });
      relaunch(routes.login);
    } catch (error) {
      await handlePageError(error, '退出登录失败');
    }
  };

  return (
    <View className="profile-container">
      <View className="profile-header">
        <View className="header-actions">
          <View className="action-item change-pwd-btn" onClick={() => void handleUpdatePassword()}>修改密码</View>
          <View className="action-item status-badge">
            <View className={`status-dot ${profile.status === '1' ? 'status-disabled' : 'status-active'}`} />
            <Text className="status-text">{profile.status === '1' ? '已禁用' : '使用中'}</Text>
          </View>
        </View>
        <AtAvatar
          circle
          size="large"
          image={avatarImage}
          text={getDisplayName(profile.userName, profile.nickName)}
        />
        <View className="user-info">
          <View className="nickname">{profile.nickName || profile.userName || '用户'}</View>
          <View className="username">账号: {profile.userName || '---'}</View>
          <View className="user-tags">
            {profile.deptName && <View className="user-tag">{profile.deptName}</View>}
            {profile.roleGroup && <View className="user-tag">{profile.roleGroup}</View>}
            {profile.postGroup && <View className="user-tag">{profile.postGroup}</View>}
          </View>
        </View>
      </View>

      <View className="profile-content">
        <View className="card-container">
          <View className="card-header">
            <Text className="card-title">基本信息</Text>
            <View className="edit-profile-btn" onClick={() => navigate(routes.profileEdit)}>编辑资料</View>
          </View>
          <View className="card-content" style={{ padding: 0 }}>
            <View className="custom-list">
              <View className="custom-list-item">
                <Text className="item-label">性别</Text>
                <Text className="item-value">{getDictLabel(sexOptions, profile.sex) || '保密'}</Text>
              </View>
              <View className="custom-list-item">
                <Text className="item-label">手机号码</Text>
                <Text className="item-value">{profile.phonenumber || '未绑定'}</Text>
              </View>
              <View className="custom-list-item">
                <Text className="item-label">电子邮箱</Text>
                <Text className="item-value">{profile.email || '未设置'}</Text>
              </View>
              <View className="custom-list-item">
                <Text className="item-label">微信小程序</Text>
                <Text className="item-value">{wechatBound ? '已绑定' : '未绑定'}</Text>
              </View>
              <View className="custom-list-item" onClick={() => navigate(routes.messages)}>
                <Text className="item-label">消息中心</Text>
                <Text className="item-value">{unreadMessageCount > 0 ? `${unreadMessageCount} 条未读` : '暂无未读'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ padding: '0 24rpx' }}>
          <AtButton className="logout-btn" onClick={() => void handleLogout()}>
            退出当前账号
          </AtButton>
        </View>
      </View>

      <View className="footer">
        <Text className="copyright">{mobileEnv.copyright}</Text>
      </View>

      <AtModal isOpened={pwdModalVisible} onClose={() => setPwdModalVisible(false)}>
        <AtModalHeader>修改密码</AtModalHeader>
        <AtModalContent>
          <View className="pwd-form-modal">
            <AtInput
              name="oldPassword"
              title="原密码"
              type="password"
              placeholder="请输入原密码"
              value={pwdForm.oldPassword}
              onChange={(val) => setPwdForm(p => ({ ...p, oldPassword: String(val) }))}
            />
            <AtInput
              name="newPassword"
              title="新密码"
              type="password"
              placeholder="请输入新密码"
              value={pwdForm.newPassword}
              onChange={(val) => setPwdForm(p => ({ ...p, newPassword: String(val) }))}
            />
            <AtInput
              name="confirmPassword"
              title="确认密码"
              type="password"
              placeholder="请确认新密码"
              value={pwdForm.confirmPassword}
              onChange={(val) => setPwdForm(p => ({ ...p, confirmPassword: String(val) }))}
            />
          </View>
        </AtModalContent>
        <View className="modal-action-section">
          <AtButton className="save-btn" type="primary" onClick={() => void handleConfirmUpdatePwd()}>确认修改</AtButton>
          <AtButton className="cancel-btn" onClick={() => setPwdModalVisible(false)}>取消</AtButton>
        </View>
      </AtModal>

      <BottomNav active="profile" />
    </View>
  );
}
