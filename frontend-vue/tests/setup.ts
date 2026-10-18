import { afterEach, beforeAll, vi } from 'vitest';

const createMemoryStorage = () => {
  const state = new Map<string, string>();
  return {
    getItem: (key: string) => (state.has(key) ? state.get(key)! : null),
    setItem: (key: string, value: string) => {
      state.set(key, String(value));
    },
    removeItem: (key: string) => {
      state.delete(key);
    },
    clear: () => {
      state.clear();
    }
  };
};

const elementPlusMock = vi.hoisted(() => ({
  ElMessage: Object.assign(vi.fn(), {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }),
  ElNotification: Object.assign(vi.fn(), {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }),
  ElMessageBox: {
    confirm: vi.fn(() => Promise.resolve()),
    alert: vi.fn(() => Promise.resolve()),
    prompt: vi.fn(() => Promise.resolve())
  },
  ElLoading: {
    service: vi.fn(() => ({
      close: vi.fn()
    }))
  },
  ElDialog: {
    props: {
      closeOnClickModal: {
        default: true
      }
    }
  }
}));

vi.mock('element-plus/es', () => {
  return elementPlusMock;
});

vi.mock('element-plus', () => {
  return {
    ...elementPlusMock,
    NotificationProps: {}
  };
});

vi.mock('element-plus/es/components/dialog/index', () => ({
  ElDialog: elementPlusMock.ElDialog,
  default: elementPlusMock.ElDialog
}));
vi.mock('element-plus/es/components/message/index', () => ({
  ElMessage: elementPlusMock.ElMessage,
  default: elementPlusMock.ElMessage
}));
vi.mock('element-plus/es/components/notification/index', () => ({
  ElNotification: elementPlusMock.ElNotification,
  default: elementPlusMock.ElNotification
}));
vi.mock('element-plus/es/components/dialog/style/css', () => ({}));
vi.mock('element-plus/es/components/message/style/css', () => ({}));
vi.mock('element-plus/es/components/notification/style/css', () => ({}));

const localStorage = createMemoryStorage();
const sessionStorage = createMemoryStorage();

Object.defineProperty(window, 'localStorage', {
  value: localStorage,
  configurable: true
});
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorage,
  configurable: true
});

if (!('execCommand' in document)) {
  Object.defineProperty(document, 'execCommand', {
    value: () => true,
    writable: true,
    configurable: true
  });
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });

  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserver,
    writable: true,
    configurable: true
  });

  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});
