import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from './api';

/** Loading / error / reload state for a stable async loader. State is only set from async callbacks. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    load()
      .then((d) => { if (active) { setData(d); setError(null); } })
      .catch((e) => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, nonce]);

  const reload = useCallback(() => { setLoading(true); setNonce((n) => n + 1); }, []);
  return { data, error, loading, reload };
}
