import { createPinia, setActivePinia } from 'pinia';
import { useUserStore } from '@/store/modules/user';
import { hasPermi, hasRoles } from '@/directive/permission';
import type { DirectiveBinding } from 'vue';

const mountTarget = () => {
  const parent = document.createElement('div');
  const el = document.createElement('button');
  parent.appendChild(el);
  return { parent, el };
};

const invokeMounted = (directive: typeof hasPermi | typeof hasRoles, el: HTMLElement, value: string[] | undefined) => {
  const binding = { value } as DirectiveBinding<string[] | undefined>;
  directive.mounted?.(el, binding, null as never, null as never);
};

describe('directive/permission', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('removes element when permission mismatch', () => {
    const userStore = useUserStore();
    userStore.permissions = ['system:user:list'];

    const { parent, el } = mountTarget();
    invokeMounted(hasPermi, el, ['system:user:add']);

    expect(parent.children.length).toBe(0);
  });

  it('keeps element when permission match', () => {
    const userStore = useUserStore();
    userStore.permissions = ['*:*:*'];

    const { parent, el } = mountTarget();
    invokeMounted(hasPermi, el, ['system:user:add']);

    expect(parent.children.length).toBe(1);
  });

  it('throws when directive value is invalid', () => {
    const { el } = mountTarget();
    expect(() => invokeMounted(hasPermi, el, undefined)).toThrow(/check perms/i);
  });

  it('removes element when role mismatch', () => {
    const userStore = useUserStore();
    userStore.roles = ['guest'];

    const { parent, el } = mountTarget();
    invokeMounted(hasRoles, el, ['admin']);

    expect(parent.children.length).toBe(0);
  });

  it('keeps element when role matched', () => {
    const userStore = useUserStore();
    userStore.roles = ['admin'];

    const { parent, el } = mountTarget();
    invokeMounted(hasRoles, el, ['editor']);

    expect(parent.children.length).toBe(1);
  });
});
