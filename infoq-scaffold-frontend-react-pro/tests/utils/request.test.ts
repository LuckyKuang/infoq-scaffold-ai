import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUmiRequest = vi.hoisted(() => vi.fn());
const mockDownload = vi.hoisted(() => vi.fn());

vi.mock('@umijs/max', () => ({
  request: mockUmiRequest,
}));

vi.mock('@/requestErrorConfig', () => ({
  download: mockDownload,
}));

const {
  default: request,
  globalHeaders,
  download,
} = await import('@/utils/request');

describe('utils/request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    process.env.VITE_APP_CLIENT_ID = 'test-client';
  });

  it('builds legacy scaffold auth headers from local token and env client id', () => {
    localStorage.setItem('Admin-Token', 'token-1');

    expect(globalHeaders()).toEqual({
      Authorization: 'Bearer token-1',
      clientid: 'test-client',
    });
  });

  it('adapts legacy config object calls to Umi request', async () => {
    mockUmiRequest.mockResolvedValueOnce({
      code: 200,
      data: {
        ok: true,
      },
    });

    const result = await request({
      url: '/system/user/list',
      method: 'post',
      data: {
        userName: 'admin',
      },
      headers: {
        repeatSubmit: false,
      },
    });

    expect(result).toEqual({
      code: 200,
      data: {
        ok: true,
      },
    });
    expect(mockUmiRequest).toHaveBeenCalledWith('/system/user/list', {
      method: 'POST',
      data: {
        userName: 'admin',
      },
      headers: {
        repeatSubmit: false,
      },
    });
  });

  it('re-exports the shared download implementation', () => {
    download('/demo/export', {}, 'demo.xlsx');

    expect(mockDownload).toHaveBeenCalledWith('/demo/export', {}, 'demo.xlsx');
  });
});
