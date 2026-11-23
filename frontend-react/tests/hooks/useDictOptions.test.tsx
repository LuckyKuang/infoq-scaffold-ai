import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const dictApi = vi.hoisted(() => ({ getDicts: vi.fn() }));
vi.mock('@/api/system/dict/data', () => dictApi);

const { default: useDictOptions, clearDictCache } = await import('@/hooks/useDictOptions');

const dictRows = (label: string) => ({ data: [{ dictLabel: label, dictValue: '0', listClass: 'success', cssClass: '' }] });

describe('hooks/useDictOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDictCache();
  });

  it('does not cache a failed fetch so the next mount retries', async () => {
    dictApi.getDicts.mockRejectedValueOnce(new Error('network'));
    const first = renderHook(() => useDictOptions('sys_status'));
    await waitFor(() => expect(dictApi.getDicts).toHaveBeenCalledTimes(1));
    expect(first.result.current.sys_status).toEqual([]);
    first.unmount();

    dictApi.getDicts.mockResolvedValueOnce(dictRows('正常'));
    const second = renderHook(() => useDictOptions('sys_status'));
    await waitFor(() => expect(second.result.current.sys_status).toEqual([expect.objectContaining({ label: '正常', value: '0' })]));
    expect(dictApi.getDicts).toHaveBeenCalledTimes(2);
  });

  it('serves cached options until the cache is cleared', async () => {
    dictApi.getDicts.mockResolvedValue(dictRows('旧'));
    const first = renderHook(() => useDictOptions('sys_status'));
    await waitFor(() => expect(first.result.current.sys_status).toHaveLength(1));
    first.unmount();

    const cached = renderHook(() => useDictOptions('sys_status'));
    expect(cached.result.current.sys_status[0].label).toBe('旧');
    expect(dictApi.getDicts).toHaveBeenCalledTimes(1);
    cached.unmount();

    clearDictCache('sys_status');
    dictApi.getDicts.mockResolvedValue(dictRows('新'));
    const refreshed = renderHook(() => useDictOptions('sys_status'));
    await waitFor(() => expect(refreshed.result.current.sys_status[0]?.label).toBe('新'));
    expect(dictApi.getDicts).toHaveBeenCalledTimes(2);
  });

  it('clears only the requested type when one is given and everything otherwise', async () => {
    dictApi.getDicts.mockImplementation(async (type: string) => dictRows(type));
    const first = renderHook(() => useDictOptions('type_a', 'type_b'));
    await waitFor(() => expect(first.result.current.type_b).toHaveLength(1));
    first.unmount();
    expect(dictApi.getDicts).toHaveBeenCalledTimes(2);

    clearDictCache('type_a');
    const second = renderHook(() => useDictOptions('type_a', 'type_b'));
    await waitFor(() => expect(second.result.current.type_a).toHaveLength(1));
    expect(dictApi.getDicts).toHaveBeenCalledTimes(3);
    second.unmount();

    clearDictCache();
    const third = renderHook(() => useDictOptions('type_a', 'type_b'));
    await waitFor(() => expect(third.result.current.type_b).toHaveLength(1));
    expect(dictApi.getDicts).toHaveBeenCalledTimes(5);
  });

  it('drops a response that was requested before the cache was cleared', async () => {
    let resolveStale: (value: ReturnType<typeof dictRows>) => void = () => undefined;
    dictApi.getDicts.mockImplementationOnce(() => new Promise((resolve) => (resolveStale = resolve)));
    const stale = renderHook(() => useDictOptions('sys_status'));
    await waitFor(() => expect(dictApi.getDicts).toHaveBeenCalledTimes(1));

    clearDictCache('sys_status');
    resolveStale(dictRows('过期'));
    await waitFor(() => expect(stale.result.current.sys_status).toHaveLength(1));
    stale.unmount();

    dictApi.getDicts.mockResolvedValueOnce(dictRows('最新'));
    const fresh = renderHook(() => useDictOptions('sys_status'));
    await waitFor(() => expect(fresh.result.current.sys_status[0]?.label).toBe('最新'));
    expect(dictApi.getDicts).toHaveBeenCalledTimes(2);
  });
});
