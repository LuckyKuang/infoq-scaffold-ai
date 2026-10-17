type JsonObject = Record<string, unknown>;
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

interface StorageCache {
  set(key: string, value: string): void;
  get(key: string): string | null;
  setJSON<T extends JsonValue>(key: string, jsonValue: T): void;
  getJSON<T = unknown>(key: string): T | null;
  remove(key: string): void;
}

const sessionCache: StorageCache = {
  set(key: string, value: string) {
    if (!sessionStorage) {
      return;
    }
    if (key != null && value != null) {
      sessionStorage.setItem(key, value);
    }
  },
  get(key: string) {
    if (!sessionStorage) {
      return null;
    }
    if (key == null) {
      return null;
    }
    return sessionStorage.getItem(key);
  },
  setJSON<T extends JsonValue>(key: string, jsonValue: T) {
    if (jsonValue != null) {
      this.set(key, JSON.stringify(jsonValue));
    }
  },
  getJSON<T = unknown>(key: string): T | null {
    const value = this.get(key);
    if (value != null) {
      return JSON.parse(value) as T;
    }
    return null;
  },
  remove(key: string) {
    sessionStorage.removeItem(key);
  }
};
const localCache: StorageCache = {
  set(key: string, value: string) {
    if (!localStorage) {
      return;
    }
    if (key != null && value != null) {
      localStorage.setItem(key, value);
    }
  },
  get(key: string) {
    if (!localStorage) {
      return null;
    }
    if (key == null) {
      return null;
    }
    return localStorage.getItem(key);
  },
  setJSON<T extends JsonValue>(key: string, jsonValue: T) {
    if (jsonValue != null) {
      this.set(key, JSON.stringify(jsonValue));
    }
  },
  getJSON<T = unknown>(key: string): T | null {
    const value = this.get(key);
    if (value != null) {
      return JSON.parse(value) as T;
    }
    return null;
  },
  remove(key: string) {
    localStorage.removeItem(key);
  }
};

export default {
  /**
   * 会话级缓存
   */
  session: sessionCache,
  /**
   * 本地缓存
   */
  local: localCache
};
