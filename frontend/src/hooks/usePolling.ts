import { useEffect, useState, type DependencyList } from "react";

const POLL_MS = 3000;

// Calls `load` now and then every 3 seconds (polling, not websockets).
// The next call is scheduled only after the previous one settles, so slow
// responses never overlap. A failed refresh keeps the last good data.
export function usePolling<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setData(null);
    setError(null);

    const tick = async () => {
      try {
        const result = await load();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    };
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, deps);

  return { data, error };
}
