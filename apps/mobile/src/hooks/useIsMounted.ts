import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a stable callback that answers "is the component still mounted?".
 *
 * Use this to guard `setState` calls that run after an `await` so that
 * updates are silently dropped when the screen has already been popped off
 * the navigation stack — this prevents RCTUIManager / Fabric view-registry
 * corruption on iOS 26 and unnecessary no-op state updates on Android.
 *
 * @example
 * const isMounted = useIsMounted();
 * async function load() {
 *   const data = await fetchSomething();
 *   if (!isMounted()) return;
 *   setData(data);
 * }
 */
export function useIsMounted(): () => boolean {
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return useCallback(() => mountedRef.current, []);
}
