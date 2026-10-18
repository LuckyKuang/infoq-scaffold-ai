import { describe, expect, it } from 'vitest';
import { resolvePageComponent } from '@/router/component-map';

describe('router/component-map', () => {
  it('resolves monitor server, datasource and invite pages', () => {
    const notFound = resolvePageComponent();

    expect(resolvePageComponent('monitor/server/index')).not.toBe(notFound);
    expect(resolvePageComponent('monitor/dataSource/index')).not.toBe(notFound);
    expect(resolvePageComponent('system/invite/index')).not.toBe(notFound);
  });
});
