import { createPinia, setActivePinia } from 'pinia';
import { useUserStore } from '@/store/modules/user';
import { checkPermi, checkRole } from '@/utils/permission';

describe('utils/permission', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('checks permission and role correctly', () => {
    const userStore = useUserStore();
    userStore.permissions = ['system:user:list'];
    userStore.roles = ['editor'];

    expect(checkPermi(['system:user:list'])).toBe(true);
    expect(checkPermi(['system:user:add'])).toBe(false);

    expect(checkRole(['editor'])).toBe(true);
    expect(checkRole(['admin'])).toBe(false);
  });

  it('returns false and logs for invalid args', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(checkPermi(undefined)).toBe(false);
    expect(checkRole(undefined)).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
