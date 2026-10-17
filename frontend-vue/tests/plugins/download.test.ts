const downloadMocks = vi.hoisted(() => {
  return {
    axios: vi.fn(),
    saveAs: vi.fn(),
    blobValidate: vi.fn(),
    globalHeaders: vi.fn(() => ({
      Authorization: 'Bearer token-a',
      clientid: 'test-client-id'
    }))
  };
});

vi.mock('axios', () => ({
  default: downloadMocks.axios
}));

vi.mock('file-saver', () => ({
  default: {
    saveAs: downloadMocks.saveAs
  }
}));

vi.mock('@/utils/scaffold', () => ({
  blobValidate: downloadMocks.blobValidate
}));

vi.mock('@/utils/request', () => ({
  globalHeaders: downloadMocks.globalHeaders
}));

import downloadPlugin from '@/plugins/download';
import { ElLoading, ElMessage } from 'element-plus/es';

describe('plugins/download', () => {
  const loadingServiceMock = ElLoading.service as unknown as ReturnType<typeof vi.fn>;
  const messageMock = ElMessage as unknown as {
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads oss file when blob response is valid', async () => {
    const close = vi.fn();
    loadingServiceMock.mockReturnValueOnce({ close });
    downloadMocks.blobValidate.mockReturnValue(true);
    downloadMocks.axios.mockResolvedValueOnce({
      data: new Blob(['file-content'], { type: 'application/octet-stream' }),
      headers: {
        'download-filename': encodeURIComponent('导出文件.xlsx')
      }
    });

    await downloadPlugin.oss(101);

    expect(downloadMocks.axios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'get',
        url: '/test-api/resource/oss/download/101',
        responseType: 'blob',
        headers: {
          Authorization: 'Bearer token-a',
          clientid: 'test-client-id'
        }
      })
    );
    expect(downloadMocks.saveAs).toHaveBeenCalledWith(expect.any(Blob), '导出文件.xlsx');
    expect(close).toHaveBeenCalled();
  });

  it('calls printErrMsg when response is not blob', async () => {
    const close = vi.fn();
    loadingServiceMock.mockReturnValueOnce({ close });
    downloadMocks.blobValidate.mockReturnValue(false);
    downloadMocks.axios.mockResolvedValueOnce({
      data: { text: () => Promise.resolve('{"code":"401","msg":"失败"}') },
      headers: {}
    });
    const printErrSpy = vi.spyOn(downloadPlugin, 'printErrMsg').mockResolvedValueOnce(undefined);

    await downloadPlugin.zip('/system/user/export', 'users.zip');

    expect(downloadMocks.axios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/test-api/system/user/export'
      })
    );
    expect(printErrSpy).toHaveBeenCalled();
    expect(downloadMocks.saveAs).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('calls printErrMsg when oss response is not blob', async () => {
    const close = vi.fn();
    loadingServiceMock.mockReturnValueOnce({ close });
    downloadMocks.blobValidate.mockReturnValue(false);
    downloadMocks.axios.mockResolvedValueOnce({
      data: { text: () => Promise.resolve('{"code":"500","msg":"导出失败"}') },
      headers: {}
    });
    const printErrSpy = vi.spyOn(downloadPlugin, 'printErrMsg').mockResolvedValueOnce(undefined);

    await downloadPlugin.oss('bad-oss');

    expect(downloadMocks.axios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/test-api/resource/oss/download/bad-oss'
      })
    );
    expect(printErrSpy).toHaveBeenCalledWith(expect.objectContaining({ text: expect.any(Function) }));
    expect(downloadMocks.saveAs).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('downloads zip file when blob response is valid', async () => {
    const close = vi.fn();
    loadingServiceMock.mockReturnValueOnce({ close });
    downloadMocks.blobValidate.mockReturnValue(true);
    downloadMocks.axios.mockResolvedValueOnce({
      data: new Blob(['zip-content'], { type: 'application/zip' }),
      headers: {}
    });

    await downloadPlugin.zip('/system/user/export', 'users.zip');

    expect(downloadMocks.axios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/test-api/system/user/export',
        responseType: 'blob'
      })
    );
    expect(downloadMocks.saveAs).toHaveBeenCalledWith(expect.any(Blob), 'users.zip');
    expect(close).toHaveBeenCalled();
  });

  it('shows error message when download throws', async () => {
    const close = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    loadingServiceMock.mockReturnValueOnce({ close });
    downloadMocks.axios.mockRejectedValueOnce(new Error('download-failed'));

    await downloadPlugin.oss('x-1');

    expect(messageMock.error).toHaveBeenCalledWith('下载文件出现错误，请联系管理员！');
    expect(close).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('shows error message when zip download throws', async () => {
    const close = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    loadingServiceMock.mockReturnValueOnce({ close });
    downloadMocks.axios.mockRejectedValueOnce(new Error('zip-download-failed'));

    await downloadPlugin.zip('/system/user/export', 'users.zip');

    expect(messageMock.error).toHaveBeenCalledWith('下载文件出现错误，请联系管理员！');
    expect(close).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('parses and displays backend error message', async () => {
    await downloadPlugin.printErrMsg({
      text: () => Promise.resolve('{"code":"401","msg":"失败"}')
    });
    expect(messageMock.error).toHaveBeenCalledWith('认证失败，无法访问系统资源');

    await downloadPlugin.printErrMsg({
      text: () => Promise.resolve('{"code":"999","msg":"自定义错误"}')
    });
    expect(messageMock.error).toHaveBeenCalledWith('自定义错误');

    await downloadPlugin.printErrMsg({
      text: () => Promise.resolve('{"code":"999"}')
    });
    expect(messageMock.error).toHaveBeenCalledWith('系统未知错误，请反馈给管理员');
  });
});
