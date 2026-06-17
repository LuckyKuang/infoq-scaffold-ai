import { describe, expect, it } from 'vitest';
import { resolvePageComponent } from './component-map';

describe('resolvePageComponent', () => {
  it('returns a lazy component for migrated backend components', () => {
    expect(resolvePageComponent('system/user/index')).toBeDefined();
  });

  it('returns undefined for unmapped backend components', () => {
    expect(resolvePageComponent('system/missing/index')).toBeUndefined();
  });
});
