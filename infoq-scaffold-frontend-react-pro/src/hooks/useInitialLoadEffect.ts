import {
  useEffect,
  useRef,
  type DependencyList,
  type EffectCallback,
} from 'react';

export default function useInitialLoadEffect(
  effect: EffectCallback,
  dependencies: DependencyList,
) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    return effect();
  }, dependencies);
}
