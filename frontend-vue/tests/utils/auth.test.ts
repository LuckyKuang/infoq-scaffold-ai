import { getToken, setToken, removeToken } from '@/utils/auth';

describe('utils/auth', () => {
  it('sets and removes token from storage', () => {
    removeToken();
    expect(getToken()).toBeNull();

    setToken('abc-token');
    expect(getToken()).toBe('abc-token');

    removeToken();
    expect(getToken()).toBeNull();
  });
});
