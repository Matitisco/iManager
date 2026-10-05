import { useState, useEffect, useRef, useCallback } from 'react';
import type { WithId, TablePageParams } from '../types';

interface UseTableDataOptions<TRow extends WithId> {
  user: any;
  fetchPage: (params: TablePageParams) => Promise<{ items: TRow[]; total: number }>;
  pageSize?: number;
}

export function useTableData<TRow extends WithId>({
  user,
  fetchPage,
  pageSize = 30,
}: UseTableDataOptions<TRow>) {
  const [items, setItems] = useState<TRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isLoadingRef = useRef(false);
  const itemsLengthRef = useRef(0);
  const totalRef = useRef(0);
  const userRef = useRef(user);
  const filterParamsRef = useRef<Omit<TablePageParams, 'skip' | 'take'>>({ filters: {} });
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { isLoadingRef.current = isInitialLoading || isLoadingMore; }, [isInitialLoading, isLoadingMore]);
  useEffect(() => { itemsLengthRef.current = items.length; }, [items.length]);
  useEffect(() => { totalRef.current = total; }, [total]);
  useEffect(() => { userRef.current = user; }, [user]);

  const loadFirstPage = useCallback(async (params: Omit<TablePageParams, 'skip' | 'take'>) => {
    if (!userRef.current) return;
    filterParamsRef.current = params;
    setItems([]);
    setIsInitialLoading(true);
    try {
      const result = await fetchPage({ skip: 0, take: pageSize, ...params });
      setItems(result.items);
      setTotal(result.total);
    } catch {}
    finally { setIsInitialLoading(false); }
  }, [fetchPage, pageSize]);

  // Infinite scroll observer — stable effect, reads via refs
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting || isLoadingRef.current || itemsLengthRef.current >= totalRef.current) return;
      const currentUser = userRef.current;
      if (!currentUser) return;
      setIsLoadingMore(true);
      fetchPage({ skip: itemsLengthRef.current, take: pageSize, ...filterParamsRef.current })
        .then(result => { setItems(prev => [...prev, ...result.items]); setTotal(result.total); })
        .catch(() => {})
        .finally(() => setIsLoadingMore(false));
    }, { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchPage, pageSize]);

  return {
    items, setItems, total, setTotal,
    isInitialLoading, isLoadingMore,
    sentinelRef, filterParamsRef, userRef,
    loadFirstPage,
  };
}
