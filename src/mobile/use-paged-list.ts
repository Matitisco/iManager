import { useCallback, useEffect, useRef, useState } from 'react';
import { MOBILE_PAGE_SIZE } from './logic';

interface Page<T> {
  items: T[];
  total: number;
}

export function usePagedList<T>(
  enabled: boolean,
  load: (skip: number, take: number) => Promise<Page<T>>,
  deps: unknown[],
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await loadRef.current(0, MOBILE_PAGE_SIZE);
      setItems(page.items);
      setTotal(page.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await loadRef.current(items.length, MOBILE_PAGE_SIZE);
      setItems((prev) => [...prev, ...page.items]);
      setTotal(page.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar más');
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, items.length, loadingMore]);

  return { items, total, loading, loadingMore, error, reload, loadMore };
}
