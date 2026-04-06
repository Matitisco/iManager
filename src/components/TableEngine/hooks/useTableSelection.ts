import { useCallback, useMemo, useState } from 'react';
import { TableData, TableRowId, TableSelectionState } from '../types';

export interface TableSelectionToggleMeta {
  shiftKey?: boolean;
}

function unique(ids: TableRowId[]) {
  return Array.from(new Set(ids));
}

export function useTableSelection<TData extends TableData>(
  data: TData[],
  onSelectionChange?: (selection: TableSelectionState) => void,
  controlledSelection?: TableSelectionState,
) {
  const [internalSelection, setInternalSelection] = useState<TableSelectionState>(() => ({
    selectedIds: controlledSelection?.selectedIds ?? [],
    allMatching: controlledSelection?.allMatching,
    matchingIds: controlledSelection?.matchingIds,
    anchorId: controlledSelection?.anchorId ?? null,
    scope: controlledSelection?.scope ?? 'page',
  }));

  const selection = controlledSelection ?? internalSelection;

  const rowIds = useMemo(() => data.map((row) => row.id), [data]);

  const commitSelection = useCallback(
    (next: TableSelectionState) => {
      if (controlledSelection === undefined) {
        setInternalSelection(next);
      }
      onSelectionChange?.(next);
    },
    [controlledSelection, onSelectionChange],
  );

  const clearSelection = useCallback(() => {
    commitSelection({
      selectedIds: [],
      allMatching: false,
      matchingIds: [],
      anchorId: null,
      scope: 'page',
    });
  }, [commitSelection]);

  const handleSelectAll = useCallback(
    (checked: boolean, matchingIds?: TableRowId[]) => {
      if (!checked) {
        clearSelection();
        return;
      }

      const nextIds = matchingIds?.length ? matchingIds : rowIds;
      commitSelection({
        selectedIds: unique(nextIds),
        allMatching: Boolean(matchingIds?.length),
        matchingIds: matchingIds?.length ? unique(matchingIds) : undefined,
        anchorId: nextIds[0] ?? null,
        scope: matchingIds?.length ? 'filtered' : 'page',
      });
    },
    [clearSelection, commitSelection, rowIds],
  );

  const handleSelectRow = useCallback(
    (rowId: TableRowId, checked: boolean, meta?: TableSelectionToggleMeta) => {
      const currentIds = selection.selectedIds ?? [];
      const anchorId = selection.anchorId ?? currentIds[currentIds.length - 1] ?? rowId;
      const rowIndex = rowIds.indexOf(rowId);
      const anchorIndex = rowIds.indexOf(anchorId ?? '');

      if (checked && meta?.shiftKey && rowIndex !== -1 && anchorIndex !== -1) {
        const [start, end] = [anchorIndex, rowIndex].sort((a, b) => a - b);
        const rangeIds = rowIds.slice(start, end + 1);
        commitSelection({
          selectedIds: unique([...currentIds, ...rangeIds]),
          allMatching: selection.allMatching,
          matchingIds: selection.matchingIds,
          anchorId: rowId,
          scope: selection.scope ?? 'page',
        });
        return;
      }

      const nextIds = checked
        ? unique([...currentIds, rowId])
        : currentIds.filter((id) => id !== rowId);

      commitSelection({
        selectedIds: nextIds,
        allMatching: selection.allMatching,
        matchingIds: selection.matchingIds,
        anchorId: rowId,
        scope: selection.scope ?? 'page',
      });
    },
    [commitSelection, rowIds, selection],
  );

  const isAllSelected = useMemo(() => {
    const comparedIds = selection.allMatching && selection.matchingIds?.length ? selection.matchingIds : rowIds;
    return comparedIds.length > 0 && comparedIds.every((id) => selection.selectedIds.includes(id));
  }, [rowIds, selection.allMatching, selection.matchingIds, selection.selectedIds]);

  const isSomeSelected = useMemo(() => {
    if (!selection.selectedIds.length) return false;
    return !isAllSelected;
  }, [isAllSelected, selection.selectedIds.length]);

  return {
    selection,
    selectedIds: selection.selectedIds,
    handleSelectAll,
    handleSelectRow,
    clearSelection,
    isAllSelected,
    isSomeSelected,
  };
}
