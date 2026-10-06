import { useState, useEffect, useRef, useCallback } from 'react';
import type { WithId, TablePageParams } from '../types';

interface UseTableDataOptions<TRow extends WithId> {
  user: any;
  fetchPage: (params: TablePageParams) => Promise<{ items: TRow[]; total: number }>;
  pageSize?: number;
  paged?: boolean;
}

export function useTableData<TRow extends WithId>({
  user,
  fetchPage,
  pageSize = 30,
  paged = false,
}: UseTableDataOptions<TRow>) {
  const [items, setItems] = useState<TRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isLoadingRef = useRef(false);
  const itemsLengthRef = useRef(0);
  const totalRef = useRef(0);
  const userRef = useRef(user);
  const pageRef = useRef(0);
  const filterParamsRef = useRef<Omit<TablePageParams, 'skip' | 'take'>>({ filters: {} });
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { isLoadingRef.current = isInitialLoading || isLoadingMore; }, [isInitialLoading, isLoadingMore]);
  useEffect(() => { itemsLengthRef.current = items.length; }, [items.length]);
  useEffect(() => { totalRef.current = total; }, [total]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { pageRef.current = page; }, [page]);

  const loadPage = useCallback(async (nextPage: number, params: Omit<TablePageParams, 'skip' | 'take'>) => {
    if (!userRef.current) return;
    filterParamsRef.current = params;
    const requestedPage = paged ? Math.max(0, nextPage) : 0;
    setItems([]);
    setIsInitialLoading(true);
    try {
      const result = await fetchPage({ skip: requestedPage * pageSize, take: pageSize, ...params });
      const lastPage = paged ? Math.max(0, Math.ceil(result.total / pageSize) - 1) : 0;
      if (paged && requestedPage > lastPage) {
        const retry = await fetchPage({ skip: lastPage * pageSize, take: pageSize, ...params });
        setItems(retry.items);
        setTotal(retry.total);
        pageRef.current = lastPage;
        setPage(lastPage);
        return;
      }
      setItems(result.items);
      setTotal(result.total);
      pageRef.current = requestedPage;
      setPage(requestedPage);
    } catch {}
    finally { setIsInitialLoading(false); }
  }, [fetchPage, pageSize, paged]);

  const loadFirstPage = useCallback(async (params: Omit<TablePageParams, 'skip' | 'take'>) => {
    await loadPage(0, params);
  }, [loadPage]);

  const goToPage = useCallback(async (nextPage: number) => {
    await loadPage(nextPage, filterParamsRef.current);
  }, [loadPage]);

  // Infinite scroll observer — stable effect, reads via refs
  useEffect(() => {
    if (paged) return;
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
  }, [fetchPage, pageSize, paged]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    items, setItems, total, setTotal,
    page, pageCount, goToPage,
    isInitialLoading, isLoadingMore,
    sentinelRef, filterParamsRef, userRef,
    loadFirstPage,
  };
}
