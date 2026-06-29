import {beforeEach, describe, expect, it, vi} from 'vitest';

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

  it('reuses identical in-flight GET requests', async () => {
    localStorage.setItem('Admin-Token', 'token-1');
    let resolveRequest:
      | ((value: { code: number; rows: unknown[] }) => void)
      | undefined;
    const pendingResponse = new Promise<{ code: number; rows: unknown[] }>(
      (resolve) => {
        resolveRequest = resolve;
      },
    );
    mockUmiRequest.mockReturnValueOnce(pendingResponse);

    const firstRequest = request({
      url: '/system/user/list',
      method: 'get',
      params: {
        pageNum: 1,
        pageSize: 10,
      },
    });
    const secondRequest = request({
      url: '/system/user/list',
      method: 'get',
      params: {
        pageSize: 10,
        pageNum: 1,
      },
    });

    expect(mockUmiRequest).toHaveBeenCalledTimes(1);
    expect(firstRequest).toBe(secondRequest);

    resolveRequest?.({ code: 200, rows: [] });
    await expect(firstRequest).resolves.toEqual({ code: 200, rows: [] });

    mockUmiRequest.mockResolvedValueOnce({ code: 200, rows: [{ id: 1 }] });
    await request({
      url: '/system/user/list',
      method: 'get',
      params: {
        pageNum: 1,
        pageSize: 10,
      },
    });
    expect(mockUmiRequest).toHaveBeenCalledTimes(2);
  });

  it('re-exports the shared download implementation', () => {
    download('/demo/export', {}, 'demo.xlsx');

    expect(mockDownload).toHaveBeenCalledWith('/demo/export', {}, 'demo.xlsx');
  });
});
