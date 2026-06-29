import {render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import useInitialLoadEffect, {clearInitialLoadEffectDedupe,} from '@/hooks/useInitialLoadEffect';

function InitialLoadProbe({
  onLoad,
  dedupeKey = 'test-initial-load',
  dedupeMs = 1000,
}: {
  onLoad: () => void;
  dedupeKey?: string;
  dedupeMs?: number;
}) {
  useInitialLoadEffect(
    () => {
      onLoad();
    },
    [onLoad],
    {dedupeKey, dedupeMs},
  );
  return <div>probe</div>;
}

describe('useInitialLoadEffect', () => {
  beforeEach(() => {
    clearInitialLoadEffectDedupe();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    clearInitialLoadEffectDedupe();
  });

  it('dedupes immediate remounts for the same initial load key', () => {
    const onLoad = vi.fn();
    const first = render(<InitialLoadProbe onLoad={onLoad} />);

    first.unmount();
    render(<InitialLoadProbe onLoad={onLoad} />);

    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('allows a later remount after the dedupe window', () => {
    const onLoad = vi.fn();
    const first = render(<InitialLoadProbe onLoad={onLoad} dedupeMs={500} />);

    first.unmount();
    vi.setSystemTime(501);
    render(<InitialLoadProbe onLoad={onLoad} dedupeMs={500} />);

    expect(onLoad).toHaveBeenCalledTimes(2);
  });
});
