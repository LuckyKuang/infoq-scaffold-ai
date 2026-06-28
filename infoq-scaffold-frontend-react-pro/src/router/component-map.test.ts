import {describe, expect, it} from 'vitest';
import {resolvePageComponent} from './component-map';

describe('resolvePageComponent', () => {
  it('returns a lazy component for migrated backend components', () => {
    expect(resolvePageComponent('system/user/index')).toBeDefined();
  });

  it('falls back to the 404 page for missing backend components', () => {
    const fallback = resolvePageComponent();

    expect(fallback).toBeDefined();
    expect(resolvePageComponent('system/missing/index')).toBe(fallback);
  });
});
