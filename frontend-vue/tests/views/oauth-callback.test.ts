import { flushPromises, mount } from '@vue/test-utils';
import OAuthCallbackView from '@/views/oauth-callback.vue';

const mocks = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  replace: vi.fn(),
  exchange: vi.fn()
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.query }),
  useRouter: () => ({ replace: mocks.replace })
}));
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ loginByOAuthTicket: mocks.exchange }) }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe('OAuth callback redirect boundary', () => {
  beforeEach(() => {
    mocks.query = { loginTicket: 'fixture-ticket' };
    mocks.exchange.mockResolvedValue(undefined);
    vi.stubEnv('BASE_URL', '/');
  });
  afterEach(() => vi.unstubAllEnvs());

  const mountView = () =>
    mount(OAuthCallbackView, {
      global: {
        config: { globalProperties: { $t: (key: string) => key } },
        stubs: {
          'el-card': { template: '<div><slot /></div>' },
          'el-result': { props: ['subTitle'], template: '<div role="alert">{{ subTitle }}<slot name="extra" /></div>' },
          'el-icon': true,
          'router-link': true
        }
      }
    });

  it.each(['/', '/vue/'])('exchanges and navigates inside %s once', async (base) => {
    vi.stubEnv('BASE_URL', base);
    mocks.query.redirect = `${base === '/' ? '' : '/vue'}/user/profile?name=a%26b#identity`;
    mountView();
    await flushPromises();
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith('fixture-ticket');
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/user/profile?name=a%26b#identity');
  });

  it('defaults an omitted redirect to /index', async () => {
    mountView();
    await flushPromises();
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/index');
  });

  it.each(['https://evil.test', '//evil.test', '/%252fevil.test', '/%5cother', '/p%0dnext', '/p%', '', null, ['/index', '/user/profile']])(
    'rejects %j before consuming the ticket',
    async (redirect) => {
      mocks.query.redirect = redirect;
      const wrapper = mountView();
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain('login.invalidRedirect');
      expect(mocks.exchange).not.toHaveBeenCalled();
      expect(mocks.replace).not.toHaveBeenCalled();
    }
  );
});
