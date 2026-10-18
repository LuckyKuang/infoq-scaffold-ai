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

const profileControlStubs = {
  'el-empty': true,
  'el-table-column': true,
  'el-tag': true,
  'el-table': true,
  'el-input': true,
  'el-option': true,
  'el-select': true,
  'el-form-item': true,
  'el-form': true,
  'el-dialog': true,
  'el-button': true
};

describe('views/system/user/profile/index', () => {
  afterEach(() => vi.unstubAllEnvs());
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
          ...profileControlStubs,
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

  it.each(['/', '/vue/'])('requests binding with a site-relative target under %s', async (base) => {
    vi.stubEnv('BASE_URL', base);
    profileMocks.getOAuthProviders.mockResolvedValue({ data: [{ providerCode: 'github', providerName: 'GitHub' }] });
    profileMocks.getProfileOauthBindAuthorizeUrl.mockReturnValue(new Promise(() => {}));
    const wrapper = mount(ProfileView, {
      global: {
        stubs: {
          ...profileControlStubs,
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-card': passthroughStub('ElCard'),
          'el-tabs': passthroughStub('ElTabs'),
          'el-tab-pane': passthroughStub('ElTabPane'),
          'el-form': passthroughStub('ElForm'),
          'el-form-item': passthroughStub('ElFormItem'),
          'el-dialog': { template: '<div><slot /><slot name="footer" /></div>' },
          'el-select': {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>'
          },
          'el-option': { props: ['value', 'label'], template: '<option :value="value">{{ label }}</option>' },
          'el-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
          'svg-icon': true,
          userAvatar: true,
          userInfo: true,
          resetPwd: true,
          onlineDevice: true
        }
      }
    });
    await flushPromises();
    await wrapper.get('select').setValue('github');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '继续授权')!
      .trigger('click');
    await flushPromises();
    expect(profileMocks.getProfileOauthBindAuthorizeUrl).toHaveBeenCalledExactlyOnceWith('github', `${base}user/profile`);
  });
});
