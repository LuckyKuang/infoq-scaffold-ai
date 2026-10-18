const inviteApiMocks = vi.hoisted(() => ({
  request: vi.fn()
}));

vi.mock('@/utils/request', () => ({
  default: inviteApiMocks.request
}));

import { cancelInvite, delInvite, generateInvite, listInvite } from '@/api/system/invite';

describe('api/system/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists invite codes with query params', () => {
    listInvite({
      pageNum: 1,
      pageSize: 10,
      inviteCode: 'INVITE',
      status: '0',
      usedUserEmail: 'user@example.com',
      creatorName: 'admin'
    });

    expect(inviteApiMocks.request).toHaveBeenCalledWith({
      url: '/system/invite/list',
      method: 'get',
      params: {
        pageNum: 1,
        pageSize: 10,
        inviteCode: 'INVITE',
        status: '0',
        usedUserEmail: 'user@example.com',
        creatorName: 'admin'
      }
    });
  });

  it('generates, cancels and deletes invite codes', () => {
    generateInvite({
      generateCount: 10,
      expireTime: '2026-12-31 23:59:59',
      remark: 'batch'
    });
    cancelInvite({
      inviteId: 100,
      canceledReason: 'manual'
    });
    delInvite([100, 101]);

    expect(inviteApiMocks.request).toHaveBeenNthCalledWith(1, {
      url: '/system/invite/generate',
      method: 'post',
      data: {
        generateCount: 10,
        expireTime: '2026-12-31 23:59:59',
        remark: 'batch'
      }
    });
    expect(inviteApiMocks.request).toHaveBeenNthCalledWith(2, {
      url: '/system/invite/cancel',
      method: 'put',
      data: {
        inviteId: 100,
        canceledReason: 'manual'
      }
    });
    expect(inviteApiMocks.request).toHaveBeenNthCalledWith(3, {
      url: '/system/invite/100,101',
      method: 'delete'
    });
  });
});
