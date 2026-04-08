import { useState, useRef } from 'react';
import type { WithId, TableFilterParams } from '../types';

export function useSelection<TRow extends WithId>(
  items: TRow[],
  total: number,
  fetchFilteredIds?: (params: TableFilterParams) => Promise<string[]>,
  filterParamsRef?: React.MutableRefObject<any>
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIndex = useRef<number>(-1);

  const allSelected = selectedIds.size > 0 && selectedIds.size >= total;

  const toggleSelectAll = async () => {
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      // Select visible items immediately for instant feedback
      const visibleIds = new Set(items.map(i => i.id));
      setSelectedIds(visibleIds);
      if (fetchFilteredIds && filterParamsRef) {
        try {
          const params = filterParamsRef.current;
          const ids = await fetchFilteredIds({ filters: params.filters ?? {}, categoryId: params.categoryId });
          setSelectedIds(new Set(ids));
        } catch {
          // keep the visible-items selection already set
        }
      }
    }
    lastSelectedIndex.current = -1;
  };

  const applySelection = (row: TRow, index: number, shiftKey: boolean) => {
    if (shiftKey && lastSelectedIndex.current !== -1) {
      const from = Math.min(lastSelectedIndex.current, index);
      const to = Math.max(lastSelectedIndex.current, index);
      const rangeIds = items.slice(from, to + 1).map(i => i.id);
      setSelectedIds(prev => { const n = new Set(prev); rangeIds.forEach(rid => n.add(rid)); return n; });
    } else {
      setSelectedIds(prev => {
        const n = new Set(prev);
        n.has(row.id) ? n.delete(row.id) : n.add(row.id);
        return n;
      });
      lastSelectedIndex.current = index;
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  return { selectedIds, setSelectedIds, allSelected, toggleSelectAll, applySelection, clearSelection };
}
