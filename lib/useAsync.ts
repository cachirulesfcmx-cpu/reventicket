import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { friendlyError } from './errors';

/**
 * Loads data whenever the screen gains focus; exposes loading / error / reload.
 * `load` must be stable (a module-level function or wrapped in useCallback).
 */
export function useFocusData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await load()); } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, [load]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { data, error, loading, reload, setData };
}
