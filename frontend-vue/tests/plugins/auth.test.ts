import { setActivePinia, createPinia } from 'pinia';
import auth from '@/plugins/auth';
import { useUserStore } from '@/store/modules/user';

describe('plugins/auth', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('checks permissions with any/all modes', () => {
    const store = useUserStore();
    store.permissions = ['system:user:list', 'system:menu:view'];

    expect(auth.hasPermi('system:user:list')).toBe(true);
    expect(auth.hasPermi('system:user:add')).toBe(false);

    expect(auth.hasPermiOr(['system:user:add', 'system:user:list'])).toBe(true);
    expect(auth.hasPermiAnd(['system:user:list', 'system:menu:view'])).toBe(true);
    expect(auth.hasPermiAnd(['system:user:list', 'system:user:add'])).toBe(false);
    expect(auth.hasPermi('')).toBe(false);
  });

  it('checks role with any/all modes', () => {
    const store = useUserStore();
    store.roles = ['editor'];

    expect(auth.hasRole('editor')).toBe(true);
    expect(auth.hasRole('admin')).toBe(false);

    expect(auth.hasRoleOr(['guest', 'editor'])).toBe(true);
    expect(auth.hasRoleAnd(['editor', 'guest'])).toBe(false);

    store.roles = ['admin'];
    expect(auth.hasRole('not-exist')).toBe(true);
    expect(auth.hasRole('')).toBe(false);
  });
});
