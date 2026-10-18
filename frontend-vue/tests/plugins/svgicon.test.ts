const iconMocks = vi.hoisted(() => {
  return {
    Edit: { name: 'EditIcon' },
    Search: { name: 'SearchIcon' }
  };
});

vi.mock('@element-plus/icons-vue', () => iconMocks);

import svgicon from '@/plugins/svgicon';
import type { App } from 'vue';

describe('plugins/svgicon', () => {
  it('registers all element-plus icons', () => {
    const app = {
      component: vi.fn()
    } as unknown as App;

    svgicon.install(app);

    expect(app.component).toHaveBeenCalledTimes(2);
    expect(app.component).toHaveBeenCalledWith('Edit', iconMocks.Edit);
    expect(app.component).toHaveBeenCalledWith('Search', iconMocks.Search);
  });
});
