import { describe, expect, it, vi } from 'vitest';
import { mergeRecursive } from '@/utils/scaffold';

describe('utils/scaffold safe recursive merge', () => {
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
    const read = vi.fn(() => { throw new Error('inherited getter must not run'); });
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
    const incoming = Object.defineProperty({}, 'field', { enumerable: true, get: () => { throw error; } });
    const source = { stable: true };
    expect(() => mergeRecursive(source, { earlier: true, nested: incoming })).toThrow(error);
    expect(source).toEqual({ stable: true });
    expect(() => mergeRecursive(incoming, { field: true })).toThrow(error);
  });
});
