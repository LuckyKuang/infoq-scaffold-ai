import {describe, expect, it} from 'vitest';
import {resolvePageComponent} from '@/router/component-map';

describe('router/component-map', () => {
  it('resolves monitor server, datasource and invite pages', () => {
    expect(resolvePageComponent('monitor/server/index')).toBeDefined();
    expect(resolvePageComponent('monitor/dataSource/index')).toBeDefined();
    expect(resolvePageComponent('system/invite/index')).toBeDefined();
  });

  it('falls back to the 404 page for missing backend components', () => {
    const fallback = resolvePageComponent();

    expect(fallback).toBeDefined();
    expect(resolvePageComponent('system/missing/index')).toBe(fallback);
  });
});
