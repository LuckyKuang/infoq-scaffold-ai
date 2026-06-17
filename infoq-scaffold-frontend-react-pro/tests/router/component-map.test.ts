import { describe, expect, it } from 'vitest';
import { resolvePageComponent } from '@/router/component-map';

describe('router/component-map', () => {
  it('resolves monitor server, datasource and invite pages', () => {
    expect(resolvePageComponent('monitor/server/index')).toBeDefined();
    expect(resolvePageComponent('monitor/dataSource/index')).toBeDefined();
    expect(resolvePageComponent('system/invite/index')).toBeDefined();
  });

  it('does not hide unmapped backend components behind a silent 404 fallback', () => {
    expect(resolvePageComponent()).toBeUndefined();
    expect(resolvePageComponent('system/missing/index')).toBeUndefined();
  });
});
