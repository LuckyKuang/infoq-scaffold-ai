import {
  parseTime,
  addDateRange,
  selectDictLabel,
  selectDictLabels,
  sprintf,
  parseStrEmpty,
  mergeRecursive,
  handleTree,
  tansParams,
  getNormalPath,
  blobValidate
} from '@/utils/scaffold';

describe('utils/scaffold', () => {
  type TreeNode = {
    id: number;
    parentId: number;
    name: string;
    children?: TreeNode[];
  };

  it('formats time from different inputs', () => {
    expect(parseTime(undefined)).toBeNull();
    expect(parseTime(1700000000, '{y}-{m}-{d}')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseTime('1700000000', '{y}')).toMatch(/^\d{4}$/);
    expect(parseTime(new Date('2024-01-07T00:00:00'), '{a}')).toBe('日');
    expect(parseTime('2024-01-01 12:00:01', '{y}/{m}/{d} {h}:{i}:{s}')).toBe('2024/01/01 12:00:01');
  });

  it('adds date range with and without prop name', () => {
    const target = addDateRange({}, ['2024-01-01', '2024-01-02']);
    expect(target.params.beginTime).toBe('2024-01-01');
    expect(target.params.endTime).toBe('2024-01-02');

    const target2 = addDateRange({ params: null }, ['2024-02-01', '2024-02-02'], 'CreateTime');
    expect(target2.params.beginCreateTime).toBe('2024-02-01');
    expect(target2.params.endCreateTime).toBe('2024-02-02');
  });

  it('maps dictionary labels', () => {
    const datas = [
      { value: '1', label: '启用' },
      { value: '0', label: '禁用' }
    ];
    expect(selectDictLabel(datas, '1')).toBe('启用');
    expect(selectDictLabel(datas, '9')).toBe('9');
    expect(selectDictLabel(datas, undefined)).toBe('');

    expect(selectDictLabels(datas, '1,0', ',')).toBe('启用,禁用');
    expect(selectDictLabels(datas, ['1', '9'], ',')).toBe('启用,9');
    expect(selectDictLabels(datas, '', ',')).toBe('');
  });

  it('formats strings and empty values', () => {
    expect(sprintf('hello %s', 'world')).toBe('hello world');
    expect(sprintf('hello %s %s', 'world')).toBe('');
    expect(sprintf(123 as unknown as string, 'world')).toBe('');
    expect(parseStrEmpty(undefined)).toBe('');
    expect(parseStrEmpty('null')).toBe('');
    expect(parseStrEmpty('value')).toBe('value');
  });

  it('merges object recursively', () => {
    const source = { a: 1, b: { c: 2 } };
    const merged = mergeRecursive(source, { b: { d: 3 }, e: 4 });
    expect(merged).toEqual({ a: 1, b: { c: 2, d: 3 }, e: 4 });

    const badObject: Record<string, unknown> = {};
    Object.defineProperty(badObject, 'constructor', {
      get() {
        throw new Error('bad-constructor');
      }
    });
    expect(() => mergeRecursive({ broken: {} }, { broken: badObject })).toThrow('Unsafe merge key: constructor');
  });

  it('merges nested records, replaces arrays and retains assigned values', () => {
    const source = { keep: 1, nested: { old: true }, list: [1, 2] };
    const list = [{ safe: true }];
    const result = mergeRecursive(source, { nested: { added: true }, list });
    expect(result).toBe(source);
    expect(result).toEqual({ keep: 1, nested: { old: true, added: true }, list: [{ safe: true }] });
    expect(result.list).toBe(list);
  });

  it.each(['__proto__', 'constructor', 'prototype'])('rejects %s at the root, in unmatched nested data and inside arrays', (key) => {
    const unsafe = JSON.parse(`{"${key}":{"polluted":true}}`);
    const source = { stable: true };
    for (const target of [unsafe, { safe: { deeply: unsafe } }, { safe: [unsafe] }]) {
      expect(() => mergeRecursive(source, target)).toThrow(`Unsafe merge key: ${key}`);
      expect(source).toEqual({ stable: true });
    }
    expect(() => mergeRecursive({ nested: unsafe }, {})).toThrow(`Unsafe merge key: ${key}`);
    expect(Object.getPrototypeOf(source)).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    expect(Object.hasOwn({}, 'polluted')).toBe(false);
  });

  it('rejects non-enumerable dangerous keys before merging', () => {
    const hidden = Object.defineProperty({}, 'constructor', { value: {} });
    expect(() => mergeRecursive({}, { hidden })).toThrow('Unsafe merge key: constructor');
  });

  it('copies only own incoming values and never reads or mutates inherited source data', () => {
    const inherited = { nested: { parentOnly: true } };
    const source = Object.create(inherited) as Record<string, unknown>;
    const target = Object.assign(Object.create({ ignored: true }), { nested: { childOnly: true } });
    mergeRecursive(source, target);
    expect(Object.keys(source)).toEqual(['nested']);
    expect(source.nested).toEqual({ childOnly: true });
    expect(inherited.nested).toEqual({ parentOnly: true });
    expect(Object.getPrototypeOf(source)).toBe(inherited);
    const read = vi.fn(() => {
      throw new Error('inherited getter must not run');
    });
    const write = vi.fn();
    const prototype = Object.defineProperty({}, 'field', { get: read, set: write });
    const destination = Object.create(prototype);
    mergeRecursive(destination, { field: 'own' });
    expect(destination.field).toBe('own');
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('propagates property access failures without returning partial success', () => {
    const error = new Error('input getter failed');
    const incoming = Object.defineProperty({}, 'field', {
      enumerable: true,
      get: () => {
        throw error;
      }
    });
    const source = { stable: true };
    expect(() => mergeRecursive(source, { earlier: true, nested: incoming })).toThrow(error);
    expect(source).toEqual({ stable: true });
    expect(() => mergeRecursive(incoming, { field: true })).toThrow(error);
  });

  it('builds tree data', () => {
    const list = [
      { id: 1, parentId: 0, name: 'root' },
      { id: 2, parentId: 1, name: 'child' }
    ];
    const tree = handleTree<TreeNode>(list);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].id).toBe(2);
  });

  it('transforms params and normal paths', () => {
    expect(tansParams({ a: 1, b: '', c: { x: '1', y: '' } })).toBe('a=1&c%5Bx%5D=1&');
    expect(getNormalPath('//system/user/')).toBe('/system/user');
    expect(getNormalPath('')).toBe('');
  });

  it('validates blob type', () => {
    expect(blobValidate({ type: 'application/octet-stream' })).toBe(true);
    expect(blobValidate({ type: 'application/json' })).toBe(false);
  });
});
