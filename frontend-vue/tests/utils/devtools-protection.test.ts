import { initDevToolsProtection } from '@/utils/devtools-protection';

const setWindowSize = (outerWidth: number, innerWidth: number, outerHeight: number, innerHeight: number) => {
  Object.defineProperty(window, 'outerWidth', {
    value: outerWidth,
    configurable: true,
    writable: true
  });
  Object.defineProperty(window, 'innerWidth', {
    value: innerWidth,
    configurable: true,
    writable: true
  });
  Object.defineProperty(window, 'outerHeight', {
    value: outerHeight,
    configurable: true,
    writable: true
  });
  Object.defineProperty(window, 'innerHeight', {
    value: innerHeight,
    configurable: true,
    writable: true
  });
};

describe('utils/devtools-protection', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('does nothing when anti-debug is disabled in development', () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITE_ENABLE_ANTI_DEBUG', 'false');

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    initDevToolsProtection();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it('starts intervals and cleans up on unload when devtools are detected initially', () => {
    vi.useFakeTimers();
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_ANTI_DEBUG', 'false');
    setWindowSize(1600, 1200, 1000, 700);

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    initDevToolsProtection();

    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 50)).toBe(true);
    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 500)).toBe(true);
    // 推进 50ms 轮询，命中 debugger interval 回调执行路径
    vi.advanceTimersByTime(60);

    window.dispatchEvent(new Event('beforeunload'));
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('opens and closes debugger interval when detection state changes', () => {
    vi.useFakeTimers();
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITE_ENABLE_ANTI_DEBUG', 'true');

    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      now += 1;
      return now;
    });

    setWindowSize(1200, 1100, 900, 860);
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    initDevToolsProtection();

    setWindowSize(1700, 1200, 1000, 700);
    vi.advanceTimersByTime(500);
    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 50)).toBe(true);

    setWindowSize(1200, 1100, 900, 860);
    vi.advanceTimersByTime(500);
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('detects open devtools via debugger time threshold', () => {
    vi.useFakeTimers();
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_ANTI_DEBUG', 'false');

    setWindowSize(1200, 1100, 900, 860);
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(20);
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    initDevToolsProtection();

    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 50)).toBe(true);
  });

  it('falls back safely when detect function throws', () => {
    vi.useFakeTimers();
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_ANTI_DEBUG', 'false');

    setWindowSize(1200, 1100, 900, 860);
    vi.spyOn(performance, 'now').mockImplementation(() => {
      throw new Error('performance-now-failed');
    });

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    initDevToolsProtection();

    // 检测失败时不会立即开启 50ms debugger 轮询，但仍会保留 500ms 状态检测
    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 50)).toBe(false);
    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 500)).toBe(true);
  });

  it('starts debugger interval on large resize when devtools transitions to open', () => {
    vi.useFakeTimers();
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITE_ENABLE_ANTI_DEBUG', 'true');

    setWindowSize(1200, 1100, 900, 860);
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      now += 1;
      return now;
    });
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    initDevToolsProtection();
    const beforeResizeDebugCalls = setIntervalSpy.mock.calls.filter((call) => call[1] === 50).length;

    // 触发超过 200 的窗口尺寸变化，并让 detectDevTools 通过尺寸差异判定为打开
    setWindowSize(1500, 900, 900, 500);
    window.dispatchEvent(new Event('resize'));
    // 推进 resize 分支下创建的 debugger interval
    vi.advanceTimersByTime(60);

    const afterResizeDebugCalls = setIntervalSpy.mock.calls.filter((call) => call[1] === 50).length;
    expect(afterResizeDebugCalls).toBeGreaterThan(beforeResizeDebugCalls);
  });
});
