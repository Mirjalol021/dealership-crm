import { useCallback, useEffect, useRef, useState } from 'react';

// Lightweight data-fetching hook that standardises loading / error / data handling
// across pages. Keeps existing useEffect+useState call sites working while adding
// the missing UX states (spinner, error banner, retry).
//
// Usage:
//   const { data, loading, error, reload } = useAsync(() => api.get<...>(path), [deps]);
//
// - `data` is null until the first successful load.
// - `loading` is true during the initial load AND on each reload.
// - `error` holds a user-facing message (from ApiError.friendly() when available).
// - `reload()` re-runs the loader (e.g. after a mutation).
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guards against setting state after unmount and against out-of-order responses.
  const mounted = useRef(true);
  const runId = useRef(0);

  const run = useCallback(() => {
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    loader()
      .then((res) => {
        if (!mounted.current || id !== runId.current) return;
        setData(res);
      })
      .catch((err: unknown) => {
        if (!mounted.current || id !== runId.current) return;
        // ApiError exposes a friendly() summary; fall back to the message.
        const msg =
          err && typeof err === 'object' && 'friendly' in err && typeof (err as { friendly: unknown }).friendly === 'function'
            ? (err as { friendly: () => string }).friendly()
            : err instanceof Error
              ? err.message
              : String(err);
        setError(msg);
      })
      .finally(() => {
        if (!mounted.current || id !== runId.current) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    run();
    return () => {
      mounted.current = false;
    };
  }, [run]);

  return { data, loading, error, reload: run };
}
