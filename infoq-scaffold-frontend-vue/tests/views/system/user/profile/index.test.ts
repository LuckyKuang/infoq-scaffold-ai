import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import ProfileView from '@/views/system/user/profile/index.vue';

const profileMocks = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  listProfileOauthIdentities: vi.fn(),
  getProfileOauthBindAuthorizeUrl: vi.fn(),
  unbindProfileOauthIdentity: vi.fn(),
  getOAuthProviders: vi.fn(),
  getOnline: vi.fn()
}));

vi.mock('@/api/system/user', () => ({
  getUserProfile: profileMocks.getUserProfile,
  listProfileOauthIdentities: profileMocks.listProfileOauthIdentities,
  getProfileOauthBindAuthorizeUrl: profileMocks.getProfileOauthBindAuthorizeUrl,
  unbindProfileOauthIdentity: profileMocks.unbindProfileOauthIdentity
}));

vi.mock('@/api/login', () => ({
  getOAuthProviders: profileMocks.getOAuthProviders
}));

vi.mock('@/api/monitor/online', () => ({
  getOnline: profileMocks.getOnline
}));

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

describe('views/system/user/profile/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMocks.getUserProfile.mockResolvedValue({
      data: {
        user: {
          userName: 'admin',
          phonenumber: '13800138000',
          email: 'admin@example.com',
          deptName: '研发中心',
          createTime: '2026-03-07 10:00:00'
        },
        roleGroup: '超级管理员',
        postGroup: '技术负责人'
      }
    });
    profileMocks.getOnline.mockResolvedValue({
      rows: [{ tokenId: 'tk-1' }]
    });
    profileMocks.listProfileOauthIdentities.mockResolvedValue({ data: [] });
    profileMocks.getOAuthProviders.mockResolvedValue({ data: [] });
  });

  it('loads profile and online device data on mount', async () => {
    const wrapper = mount(ProfileView, {
      global: {
        stubs: {
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-card': passthroughStub('ElCard'),
          'el-tabs': passthroughStub('ElTabs'),
          'el-tab-pane': passthroughStub('ElTabPane'),
          'svg-icon': true,
          userAvatar: true,
          userInfo: true,
          resetPwd: true,
          onlineDevice: true
        }
      }
    });

    await flushPromises();

    expect(profileMocks.getUserProfile).toHaveBeenCalledTimes(1);
    expect(profileMocks.getOnline).toHaveBeenCalledTimes(1);
    expect(profileMocks.listProfileOauthIdentities).toHaveBeenCalledTimes(1);
    expect(profileMocks.getOAuthProviders).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('admin');
    expect(wrapper.text()).toContain('13800138000');
    expect(wrapper.text()).toContain('admin@example.com');
    expect(wrapper.text()).toContain('研发中心 / 技术负责人');
    expect(wrapper.text()).toContain('超级管理员');
    expect(wrapper.text()).toContain('2026-03-07 10:00:00');
  });
});
