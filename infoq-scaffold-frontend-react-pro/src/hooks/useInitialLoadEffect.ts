import {type DependencyList, type EffectCallback, useEffect, useRef,} from 'react';

type InitialLoadEffectOptions = {
  dedupeKey?: string;
  dedupeMs?: number;
};

const DEFAULT_DEDUPE_MS = 1500;
const recentInitialLoads = new Map<string, number>();

const resolveCallerKey = () => {
  const stack = new Error().stack || '';
  return (
    stack
      .split('\n')
      .map((line) => line.trim())
      .find(
        (line) =>
          line &&
          line !== 'Error' &&
          !line.includes('resolveCallerKey') &&
          !line.includes('useInitialLoadEffect'),
      ) || stack
  );
};

const pruneRecentInitialLoads = (now: number, dedupeMs: number) => {
  recentInitialLoads.forEach((startedAt, key) => {
    if (now - startedAt > dedupeMs) {
      recentInitialLoads.delete(key);
    }
  });
};

export const clearInitialLoadEffectDedupe = () => {
  recentInitialLoads.clear();
};

export default function useInitialLoadEffect(
  effect: EffectCallback,
  dependencies: DependencyList,
  options: InitialLoadEffectOptions = {},
) {
  const startedRef = useRef(false);
  const keyRef = useRef(options.dedupeKey || resolveCallerKey());

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    const dedupeMs = options.dedupeMs ?? DEFAULT_DEDUPE_MS;
    if (dedupeMs > 0) {
      const now = Date.now();
      pruneRecentInitialLoads(now, dedupeMs);
      const lastStartedAt = recentInitialLoads.get(keyRef.current);
      if (lastStartedAt !== undefined && now - lastStartedAt <= dedupeMs) {
        return;
      }
      recentInitialLoads.set(keyRef.current, now);
    }
    return effect();
  }, dependencies);
}
