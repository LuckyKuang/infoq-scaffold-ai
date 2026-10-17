import { afterEach, describe, expect, it, vi } from 'vitest';
import { notification } from 'antd';
import modal from '@/utils/modal';

describe('utils/modal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps string notifications to title', () => {
    const successSpy = vi.spyOn(notification, 'success').mockImplementation(() => {
      return {
        then: undefined
      } as never;
    });

    modal.notifySuccess('操作成功');

    expect(successSpy).toHaveBeenCalledWith({
      title: '操作成功'
    });
  });

  it('passes title notifications through directly', () => {
    const errorSpy = vi.spyOn(notification, 'error').mockImplementation(() => {
      return {
        then: undefined
      } as never;
    });

    modal.notifyError({
      title: '请求失败',
      description: '服务不可用',
      duration: 3
    });

    expect(errorSpy).toHaveBeenCalledWith({
      title: '请求失败',
      description: '服务不可用',
      duration: 3
    });
  });

  it('keeps explicit title untouched', () => {
    const warningSpy = vi.spyOn(notification, 'warning').mockImplementation(() => {
      return {
        then: undefined
      } as never;
    });

    modal.notifyWarning({
      title: '消息',
      description: '实时通知'
    });

    expect(warningSpy).toHaveBeenCalledWith({
      title: '消息',
      description: '实时通知'
    });
  });
});
