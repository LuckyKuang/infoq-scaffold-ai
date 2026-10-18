import { createPinia, setActivePinia } from 'pinia';
import { useDictStore } from '@/store/modules/dict';
import { useDict } from '@/utils/dict';

vi.mock('@/api/system/dict/data', () => ({
  getDicts: vi.fn((dictType: string) =>
    Promise.resolve({
      data: [
        { dictLabel: `${dictType}-A`, dictValue: 'A', listClass: 'success', cssClass: 'cls-a' },
        { dictLabel: `${dictType}-B`, dictValue: 'B', listClass: 'warning', cssClass: 'cls-b' }
      ]
    })
  )
}));

describe('utils/dict', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('returns cached dict immediately when exists', () => {
    const dictStore = useDictStore();
    dictStore.setDict('sys_yes_no', [{ label: '是', value: 'Y' } as DictDataOption]);

    const result = useDict('sys_yes_no');
    expect(result.sys_yes_no).toEqual([{ label: '是', value: 'Y' }]);
  });

  it('requests dict and writes to store when cache missed', async () => {
    const dictStore = useDictStore();
    const result = useDict('sys_status');

    await Promise.resolve();
    await Promise.resolve();

    expect(result.sys_status).toEqual([
      { label: 'sys_status-A', value: 'A', elTagType: 'success', elTagClass: 'cls-a' },
      { label: 'sys_status-B', value: 'B', elTagType: 'warning', elTagClass: 'cls-b' }
    ]);
    expect(dictStore.getDict('sys_status')).toEqual(result.sys_status);
  });
});
