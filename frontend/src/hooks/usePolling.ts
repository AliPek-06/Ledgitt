import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

const POLL_MS = 3000;

// Calls `load` now and then every 3 seconds (polling, not websockets).
// The next call is scheduled only after the previous one settles, so slow
// responses never overlap. A failed refresh keeps the last good data.
// `refresh()` polls again immediately, e.g. after the user changes data. If a
// poll is already running it may predate the change, so one more follows it.
export function usePolling<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setData(null);
    setError(null);

    const tick = async () => {
      clearTimeout(timer);
      inFlight = true;
      try {
        const result = await load();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight = false;
        if (!cancelled) {
          if (again) {
            again = false;
            tick();
          } else {
            timer = setTimeout(tick, POLL_MS);
          }
        }
      }
    };
    kick.current = () => {
      if (inFlight) again = true;
      else tick();
    };
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, deps);

  const refresh = useCallback(() => kick.current(), []);
  return { data, error, refresh };
}
