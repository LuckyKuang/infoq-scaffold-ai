import modal from '@/plugins/modal';
import { ElLoading, ElMessage, ElMessageBox, ElNotification } from 'element-plus/es';

describe('plugins/modal', () => {
  const messageMock = ElMessage as unknown as {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  };
  const notificationMock = ElNotification as unknown as {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  };
  const messageBoxMock = ElMessageBox as unknown as {
    alert: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
    prompt: ReturnType<typeof vi.fn>;
  };
  const loadingServiceMock = ElLoading.service as unknown as ReturnType<typeof vi.fn>;
  const loadingMock = ElLoading as unknown as {
    service: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches message methods', () => {
    modal.msg('info');
    modal.msgError('error');
    modal.msgSuccess('success');
    modal.msgWarning('warning');

    expect(messageMock.info).toHaveBeenCalledWith('info');
    expect(messageMock.error).toHaveBeenCalledWith('error');
    expect(messageMock.success).toHaveBeenCalledWith('success');
    expect(messageMock.warning).toHaveBeenCalledWith('warning');
  });

  it('dispatches alert, notification, confirm and prompt', async () => {
    modal.alert('alert');
    modal.alertError('alert-error');
    modal.alertSuccess('alert-success');
    modal.alertWarning('alert-warning');

    modal.notify('notify');
    modal.notifyError('notify-error');
    modal.notifySuccess('notify-success');
    modal.notifyWarning('notify-warning');

    await modal.confirm('confirm');
    await modal.prompt('prompt');

    expect(messageBoxMock.alert).toHaveBeenCalledTimes(4);
    expect(notificationMock.info).toHaveBeenCalledWith('notify');
    expect(notificationMock.error).toHaveBeenCalledWith('notify-error');
    expect(notificationMock.success).toHaveBeenCalledWith('notify-success');
    expect(notificationMock.warning).toHaveBeenCalledWith('notify-warning');
    expect(messageBoxMock.confirm).toHaveBeenCalledWith('confirm', '系统提示', expect.objectContaining({ type: 'warning' }));
    expect(messageBoxMock.prompt).toHaveBeenCalledWith('prompt', '系统提示', expect.objectContaining({ type: 'warning' }));
  });

  it('opens and closes loading overlay', () => {
    const close = vi.fn();
    loadingServiceMock.mockReturnValueOnce({ close });

    modal.loading('处理中');
    modal.closeLoading();

    expect(loadingMock.service).toHaveBeenCalledWith(
      expect.objectContaining({
        lock: true,
        text: '处理中'
      })
    );
    expect(close).toHaveBeenCalled();
  });
});
