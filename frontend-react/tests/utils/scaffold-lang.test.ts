import { describe, expect, it } from 'vitest';
import { getLanguage } from '@/lang';
import { addDateRange, handleTree, parseTime, selectDictLabel, selectDictLabels } from '@/utils/scaffold';

type StrictTreeNode = {
  id: number;
  parentId: number;
  children?: StrictTreeNode[];
};

type LooseTreeNode = {
  id?: number;
  parentId?: number;
  children?: LooseTreeNode[];
};

describe('utils/scaffold-lang', () => {
  it('reads language from localStorage', () => {
    localStorage.setItem('language', 'en_US');
    expect(getLanguage()).toBe('en_US');
  });

  it('formats time and date range', () => {
    expect(parseTime(1700000000000)).toContain('-');

    const data = addDateRange({ name: 'x' }, ['2026-01-01', '2026-01-31']);
    expect(data.params.beginTime).toBe('2026-01-01');
    expect(data.params.endTime).toBe('2026-01-31');
  });

  it('builds tree structure', () => {
    const tree = handleTree<StrictTreeNode>([
      { id: 1, parentId: 0, children: [] },
      { id: 2, parentId: 1, children: [] }
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children?.[0].children).toBeUndefined();
  });

  it('removes invalid and empty leaf children when building tree', () => {
    const tree = handleTree<LooseTreeNode>([
      { id: 10, parentId: 0, children: [{ id: 11 }, {}] },
      { id: 11, parentId: 10, children: [] }
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children?.[0].id).toBe(11);
    expect(tree[0].children?.[0].children).toBeUndefined();
  });

  it('resolves dict labels', () => {
    const dict = [
      { label: '正常', value: '0' },
      { label: '停用', value: '1' }
    ];

    expect(selectDictLabel(dict, '0')).toBe('正常');
    expect(selectDictLabels(dict, '0,1', ',')).toBe('正常,停用');
  });
});
