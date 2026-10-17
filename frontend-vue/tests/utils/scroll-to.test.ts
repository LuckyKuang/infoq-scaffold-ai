describe('utils/scroll-to', () => {
  type AnimationFrameFn = (cb: FrameRequestCallback) => number;
  type WindowAnimationPatch = {
    requestAnimationFrame?: AnimationFrameFn;
    webkitRequestAnimationFrame?: AnimationFrameFn;
    mozRequestAnimationFrame?: AnimationFrameFn;
  };

  const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
  const originalWebkitRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, 'webkitRequestAnimationFrame');
  const originalMozRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, 'mozRequestAnimationFrame');

  const setAnimationApis = (raf?: AnimationFrameFn, webkit?: AnimationFrameFn, moz?: AnimationFrameFn) => {
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: raf,
      configurable: true,
      writable: true
    });
    Object.defineProperty(window, 'webkitRequestAnimationFrame', {
      value: webkit,
      configurable: true,
      writable: true
    });
    Object.defineProperty(window, 'mozRequestAnimationFrame', {
      value: moz,
      configurable: true,
      writable: true
    });
  };

  const restoreAnimationApis = () => {
    if (originalRequestAnimationFrame) {
      Object.defineProperty(window, 'requestAnimationFrame', originalRequestAnimationFrame);
    } else {
      delete (window as WindowAnimationPatch).requestAnimationFrame;
    }
    if (originalWebkitRequestAnimationFrame) {
      Object.defineProperty(window, 'webkitRequestAnimationFrame', originalWebkitRequestAnimationFrame);
    } else {
      delete (window as WindowAnimationPatch).webkitRequestAnimationFrame;
    }
    if (originalMozRequestAnimationFrame) {
      Object.defineProperty(window, 'mozRequestAnimationFrame', originalMozRequestAnimationFrame);
    } else {
      delete (window as WindowAnimationPatch).mozRequestAnimationFrame;
    }
  };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    restoreAnimationApis();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('animates scroll position and invokes callback', async () => {
    vi.useFakeTimers();
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(performance.now()), 0);
    });

    document.documentElement.scrollTop = 0;
    (document.body.parentNode as HTMLElement).scrollTop = 0;
    document.body.scrollTop = 0;

    const { scrollTo } = await import('@/utils/scroll-to');
    const done = vi.fn();

    scrollTo(120, 40, done);
    vi.runAllTimers();

    expect(document.documentElement.scrollTop).toBe(120);
    expect((document.body.parentNode as HTMLElement).scrollTop).toBe(120);
    expect(document.body.scrollTop).toBe(120);
    expect(done).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameSpy).toHaveBeenCalled();
  });

  it('uses default duration when duration is undefined', async () => {
    vi.useFakeTimers();
    setAnimationApis((cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 0), undefined, undefined);

    document.documentElement.scrollTop = 0;
    (document.body.parentNode as HTMLElement).scrollTop = 0;
    document.body.scrollTop = 0;

    const { scrollTo } = await import('@/utils/scroll-to');

    // 覆盖 duration 默认值分支，同时命中 easeInOutQuad 的 t < 1 分支
    scrollTo(200, undefined as unknown as number);
    vi.runAllTimers();

    expect(document.documentElement.scrollTop).toBe(200);
    expect((document.body.parentNode as HTMLElement).scrollTop).toBe(200);
    expect(document.body.scrollTop).toBe(200);
  });

  it('falls back to setTimeout when requestAnimationFrame APIs are unavailable', async () => {
    vi.useFakeTimers();
    setAnimationApis(undefined, undefined, undefined);

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    document.documentElement.scrollTop = 0;
    (document.body.parentNode as HTMLElement).scrollTop = 0;
    document.body.scrollTop = 0;

    const { scrollTo } = await import('@/utils/scroll-to');
    scrollTo(80, 40);
    vi.runAllTimers();

    const hasRafFallbackDelay = setTimeoutSpy.mock.calls.some(([, delay]) => Math.abs(Number(delay) - 1000 / 60) < 0.001);
    expect(hasRafFallbackDelay).toBe(true);
    expect(document.documentElement.scrollTop).toBe(80);
  });
});
