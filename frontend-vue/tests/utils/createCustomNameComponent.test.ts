import { mount } from '@vue/test-utils';
import { createCustomNameComponent } from '@/utils/createCustomNameComponent';
import { defineComponent, h } from 'vue';
import type { Component } from 'vue';

type NamedComponent = {
  name: string;
};

describe('utils/createCustomNameComponent', () => {
  it('loads component lazily and caches loader result', async () => {
    const loader = vi.fn(async () => ({
      default: defineComponent({
        name: 'LoadedComponent',
        render() {
          return h('div', 'loaded');
        }
      })
    }));

    const factory = createCustomNameComponent(loader, { name: 'WrappedRouteComponent' });
    const wrapped1 = await factory();
    const wrapped2 = await factory();

    expect(loader).toHaveBeenCalledTimes(1);
    expect((wrapped1 as NamedComponent).name).toBe('WrappedRouteComponent');
    expect((wrapped2 as NamedComponent).name).toBe('WrappedRouteComponent');

    const rendered = mount(wrapped1 as Component);
    expect(rendered.text()).toContain('loaded');
  });

  it('handles load failure gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loader = vi.fn(async () => {
      throw new Error('load-failed');
    });

    const factory = createCustomNameComponent(loader, { name: 'BrokenRoute' });
    const wrapped = await factory();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect((wrapped as NamedComponent).name).toBe('BrokenRoute');
    consoleErrorSpy.mockRestore();
  });
});
