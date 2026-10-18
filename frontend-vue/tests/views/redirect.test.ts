import { mount } from '@vue/test-utils';

const redirectMocks = vi.hoisted(() => {
  return {
    replace: vi.fn(),
    route: {
      params: {
        path: 'system/user'
      },
      query: {
        id: '1001'
      }
    }
  };
});

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => redirectMocks.route),
  useRouter: vi.fn(() => ({
    replace: redirectMocks.replace
  }))
}));

import RedirectView from '@/views/redirect/index.vue';

describe('views/redirect', () => {
  it('replaces route with decoded path and original query', () => {
    mount(RedirectView);

    expect(redirectMocks.replace).toHaveBeenCalledWith({
      path: '/system/user',
      query: {
        id: '1001'
      }
    });
  });
});
