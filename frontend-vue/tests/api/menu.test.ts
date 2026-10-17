const menuApiMocks = vi.hoisted(() => ({
  request: vi.fn()
}));

vi.mock('@/utils/request', () => ({
  default: menuApiMocks.request
}));

import { getRouters } from '@/api/menu';

describe('api/menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests router tree data', () => {
    getRouters();

    expect(menuApiMocks.request).toHaveBeenCalledWith({
      url: '/system/menu/getRouters',
      method: 'get'
    });
  });
});
