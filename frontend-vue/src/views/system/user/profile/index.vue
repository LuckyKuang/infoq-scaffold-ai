<template>
  <div class="p-2">
    <el-row :gutter="20">
      <el-col :span="6" :xs="24">
        <el-card class="box-card">
          <template #header>
            <div class="clearfix">
              <span>个人信息</span>
            </div>
          </template>
          <div>
            <div class="text-center">
              <userAvatar />
            </div>
            <ul class="list-group list-group-striped">
              <li class="list-group-item">
                <svg-icon icon-class="user" />用户名称
                <div class="pull-right">{{ state.user.userName }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="phone" />手机号码
                <div class="pull-right">{{ state.user.phonenumber }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="email" />用户邮箱
                <div class="pull-right">{{ state.user.email }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="tree" />所属部门
                <div v-if="state.user.deptName" class="pull-right">{{ state.user.deptName }} / {{ state.postGroup }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="peoples" />所属角色
                <div class="pull-right">{{ state.roleGroup }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="date" />创建日期
                <div class="pull-right">{{ state.user.createTime }}</div>
              </li>
            </ul>
          </div>
        </el-card>
      </el-col>
      <el-col :span="18" :xs="24">
        <el-card>
          <template #header>
            <div class="clearfix">
              <span>基本资料</span>
            </div>
          </template>
          <el-tabs v-model="activeTab">
            <el-tab-pane label="基本资料" name="userinfo">
              <userInfo :user="userForm" />
            </el-tab-pane>
            <el-tab-pane label="修改密码" name="resetPwd">
              <resetPwd />
            </el-tab-pane>
            <el-tab-pane label="在线设备" name="onlineDevice">
              <onlineDevice :devices="state.devices" />
            </el-tab-pane>
            <el-tab-pane label="账号关联" name="oauthIdentity">
              <el-button type="primary" icon="Link" :disabled="providers.length === 0" @click="bindDialogVisible = true">绑定第三方账号</el-button>
              <el-empty v-if="identities.length === 0" description="尚未绑定第三方账号" />
              <el-table v-else :data="identities" class="mt-4">
                <el-table-column label="第三方平台" prop="providerName" />
                <el-table-column label="状态" width="110">
                  <template #default="scope"
                    ><el-tag :type="scope.row.status === '0' ? 'success' : 'info'">{{
                      scope.row.status === '0' ? '已绑定' : '已停用'
                    }}</el-tag></template
                  >
                </el-table-column>
                <el-table-column label="最近登录" prop="lastLoginTime" min-width="180" />
                <el-table-column label="操作" width="100">
                  <template #default="scope"
                    ><el-button link type="danger" icon="Delete" @click="openUnbindDialog(scope.row)">解绑</el-button></template
                  >
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
    <el-dialog v-model="bindDialogVisible" title="绑定第三方账号" width="400px" append-to-body>
      <el-form label-width="100px">
        <el-form-item label="第三方平台" required>
          <el-select v-model="bindProvider" placeholder="请选择第三方平台" class="w-full">
            <el-option v-for="provider in providers" :key="provider.providerCode" :label="provider.providerName" :value="provider.providerCode" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="bindDialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="submitting" @click="handleBind">继续授权</el-button></template
      >
    </el-dialog>
    <el-dialog v-model="unbindDialogVisible" title="解绑第三方账号" width="400px" append-to-body>
      <p>确认解绑 {{ unbindTarget?.providerName }}？</p>
      <el-form v-if="unbindTarget?.passwordConfirmationRequired" label-width="100px">
        <el-form-item label="当前密码" required>
          <el-input v-model="currentPassword" type="password" show-password autocomplete="current-password" />
        </el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="unbindDialogVisible = false">取消</el-button
        ><el-button type="danger" :loading="submitting" @click="handleUnbind">确认解绑</el-button></template
      >
    </el-dialog>
  </div>
</template>

<script setup name="Profile" lang="ts">
import UserAvatar from './userAvatar.vue';
import UserInfo from './userInfo.vue';
import ResetPwd from './resetPwd.vue';
import OnlineDevice from './onlineDevice.vue';
import { ElMessage } from 'element-plus';
import { getProfileOauthBindAuthorizeUrl, getUserProfile, listProfileOauthIdentities, unbindProfileOauthIdentity } from '@/api/system/user';
import { getOAuthProviders } from '@/api/login';
import { getOnline } from '@/api/monitor/online';
import { ProfileOauthIdentityVO, UserVO } from '@/api/system/user/types';

const activeTab = ref('userinfo');
interface State {
  user: Partial<UserVO>;
  roleGroup: string;
  postGroup: string;
  auths: unknown[];
  devices: Array<Record<string, unknown>>;
}
const state = ref<State>({
  user: {},
  roleGroup: '',
  postGroup: '',
  auths: [],
  devices: []
});

const userForm = ref<Record<string, unknown>>({});
const identities = ref<ProfileOauthIdentityVO[]>([]);
const providers = ref<Array<{ providerCode: string; providerName: string }>>([]);
const bindDialogVisible = ref(false);
const unbindDialogVisible = ref(false);
const bindProvider = ref('');
const currentPassword = ref('');
const unbindTarget = ref<ProfileOauthIdentityVO>();
const submitting = ref(false);

const getUser = async () => {
  const res = await getUserProfile();
  state.value.user = res.data.user;
  userForm.value = { ...res.data.user };
  state.value.roleGroup = res.data.roleGroup;
  state.value.postGroup = res.data.postGroup;
};

const getOnlines = async () => {
  const res = await getOnline();
  state.value.devices = res.rows;
};

const getOauthIdentities = async () => {
  const res = await listProfileOauthIdentities();
  identities.value = res.data;
};

const openUnbindDialog = (identity: ProfileOauthIdentityVO) => {
  unbindTarget.value = identity;
  currentPassword.value = '';
  unbindDialogVisible.value = true;
};

const handleBind = async () => {
  if (!bindProvider.value) {
    ElMessage.warning('请选择第三方平台');
    return;
  }
  submitting.value = true;
  try {
    const res = await getProfileOauthBindAuthorizeUrl(bindProvider.value, `${window.location.origin}/user/profile`);
    window.location.assign(res.data);
  } finally {
    submitting.value = false;
  }
};

const handleUnbind = async () => {
  if (!unbindTarget.value) return;
  if (unbindTarget.value.passwordConfirmationRequired && !currentPassword.value) {
    ElMessage.warning('请输入当前密码');
    return;
  }
  submitting.value = true;
  try {
    await unbindProfileOauthIdentity(unbindTarget.value.identityId, currentPassword.value || undefined);
    unbindDialogVisible.value = false;
    await getOauthIdentities();
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  void getUser();
  void getOnlines();
  void getOauthIdentities();
  void getOAuthProviders().then((res) => {
    providers.value = res.data;
  });
});
</script>
