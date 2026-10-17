const setJSON = (storage: Storage, key: string, value: unknown) => {
  storage.setItem(key, JSON.stringify(value));
};

const getJSON = <T>(storage: Storage, key: string): T | null => {
  const value = storage.getItem(key);
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const remove = (storage: Storage, key: string) => storage.removeItem(key);

const session = {
  setJSON: (key: string, value: unknown) => setJSON(sessionStorage, key, value),
  getJSON: <T>(key: string) => getJSON<T>(sessionStorage, key),
  remove: (key: string) => remove(sessionStorage, key)
};

const local = {
  setJSON: (key: string, value: unknown) => setJSON(localStorage, key, value),
  getJSON: <T>(key: string) => getJSON<T>(localStorage, key),
  remove: (key: string) => remove(localStorage, key)
};

export default {
  session,
  local
};
