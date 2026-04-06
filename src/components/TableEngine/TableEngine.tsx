import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TableEngineProps, TableData, TableRemoteQuery, TableSelectionState } from './types';
import { TableHeader } from './components/TableHeader';
import { TableRow } from './components/TableRow';
import { useTableSort } from './hooks/useTableSort';
import { useTablePagination } from './hooks/useTablePagination';
import { useTableSelection } from './hooks/useTableSelection';
import { useColumnCustomization } from './hooks/useColumnCustomization';

/**
 * A highly reusable, feature-rich data table engine.
 */
export function TableEngine<TData extends TableData>({
  data,
  columns: initialColumns,
  features,
  callbacks,
  plugins,
  adapter,
  state,
  onStateChange,
  viewId,
  isLoading = false,
  emptyState,
  appendRow,
  selectedIds,
}: TableEngineProps<TData>) {
  const tableRef = useRef<HTMLTableElement>(null);
  const remoteQuerySignatureRef = useRef<string>('');
  const [remoteRows, setRemoteRows] = useState<TData[]>(data);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteTotalItems, setRemoteTotalItems] = useState<number | undefined>(undefined);
  const [remoteHasNextPage, setRemoteHasNextPage] = useState<boolean | undefined>(undefined);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const [selectionState, setSelectionState] = useState<TableSelectionState>(() => ({
    selectedIds: selectedIds ?? state?.selection?.selectedIds ?? [],
    allMatching: state?.selection?.allMatching,
    matchingIds: state?.selection?.matchingIds,
    anchorId: state?.selection?.anchorId ?? null,
    scope: state?.selection?.scope ?? 'page',
  }));
  const [contextMenuState, setContextMenuState] = useState<{
    rowId?: string;
    x: number;
    y: number;
  } | null>(
    state?.contextMenu
      ? {
          rowId: state.contextMenu.rowId,
          x: state.contextMenu.position?.x ?? 0,
          y: state.contextMenu.position?.y ?? 0,
        }
      : null,
  );

  useEffect(() => {
    if (selectedIds !== undefined) {
      setSelectionState((current) => ({
        ...current,
        selectedIds,
      }));
    }
  }, [selectedIds]);

  useEffect(() => {
    if (state?.selection) {
      setSelectionState({
        selectedIds: state.selection.selectedIds ?? [],
        allMatching: state.selection.allMatching,
        matchingIds: state.selection.matchingIds,
        anchorId: state.selection.anchorId ?? null,
        scope: state.selection.scope ?? 'page',
      });
    }
  }, [state?.selection]);

  useEffect(() => {
    if (state?.contextMenu) {
      setContextMenuState({
        rowId: state.contextMenu.rowId,
        x: state.contextMenu.position?.x ?? 0,
        y: state.contextMenu.position?.y ?? 0,
      });
    }
  }, [state?.contextMenu]);

  const { columns, visibleColumns, toggleColumnVisibility, reorderColumnById, resizeColumn, renameColumn } =
    useColumnCustomization(initialColumns, {
      viewId,
      onColumnPreferencesChange: onStateChange?.onColumnPreferencesChange,
    });

  const { sortedData, sortColumn, sortDirection, handleSort } = useTableSort(
    data,
    visibleColumns,
    state?.sorting?.columnId ?? null,
    state?.sorting?.direction ?? null,
    (columnId, direction) => {
      callbacks?.onSortChange?.(columnId, direction);
      onStateChange?.onSortingChange?.({
        columnId,
        direction,
      });
    },
  );

  const { paginatedData, currentPage, pageSize, totalItems, totalPages, handlePageChange } = useTablePagination(
    sortedData,
    state?.pagination?.pageIndex ?? 1,
    state?.pagination?.pageSize ?? 30,
    (page, nextPageSize) => {
      callbacks?.onPageChange?.(page, nextPageSize);
      onStateChange?.onPaginationChange?.({
        pageIndex: page,
        pageSize: nextPageSize,
        totalItems,
        totalPages,
      });
    },
  );

  const displayData = features?.pagination ? paginatedData : sortedData;
  const remoteMode = adapter?.mode === 'remote' && typeof adapter.fetchPage === 'function';
  const tableData = remoteMode ? remoteRows : displayData;
  const rowActions = useMemo(() => plugins?.flatMap((plugin) => plugin.rowActions ?? []) ?? [], [plugins]);
  const bulkActions = useMemo(() => plugins?.flatMap((plugin) => plugin.bulkActions ?? []) ?? [], [plugins]);

  const remoteQuery = useMemo<TableRemoteQuery>(
    () => ({
      sorting: sortColumn
        ? {
            columnId: sortColumn,
            direction: sortDirection,
          }
        : undefined,
      pagination: {
        pageIndex: currentPage,
        pageSize,
      },
      filters: state?.filters,
      search: state?.search,
    }),
    [currentPage, pageSize, sortColumn, sortDirection, state?.filters, state?.search],
  );

  useEffect(() => {
    if (!remoteMode) {
      setRemoteRows(data);
      setRemoteLoading(false);
      return;
    }

    let cancelled = false;
    const signature = JSON.stringify({
      sorting: remoteQuery.sorting ?? null,
      filters: remoteQuery.filters ?? null,
      search: remoteQuery.search ?? null,
      pageSize: remoteQuery.pagination?.pageSize ?? null,
    });
    const shouldAppend = remoteQuerySignatureRef.current === signature && remoteQuery.pagination?.pageIndex && remoteQuery.pagination.pageIndex > 1;

    remoteQuerySignatureRef.current = signature;
    setRemoteLoading(true);
    setRemoteError(null);

    void (async () => {
      try {
        const result = await adapter.fetchPage(remoteQuery);
        if (cancelled) return;

        setRemoteRows((current) =>
          shouldAppend ? [...current, ...result.rows] : result.rows,
        );
        setRemoteTotalItems(result.totalItems);
        setRemoteHasNextPage(result.hasNextPage);
      } catch (error) {
        if (cancelled) return;
        setRemoteError(error instanceof Error ? error.message : 'Failed to load remote rows');
      } finally {
        if (!cancelled) {
          setRemoteLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adapter, data, remoteMode, remoteQuery]);

  const {
    selectedIds: selectedRowIds,
    handleSelectAll,
    handleSelectRow,
    isAllSelected,
    isSomeSelected,
    clearSelection,
  } = useTableSelection(
    displayData,
    (next) => {
      setSelectionState(next);
      callbacks?.onSelectionChange?.(next.selectedIds);
      onStateChange?.onSelectionChange?.(next, { rows: tableData.filter((row) => next.selectedIds.includes(row.id)) });
    },
    selectionState,
  );

  const query = useMemo<TableRemoteQuery>(
    () => ({
      sorting: sortColumn
        ? {
            columnId: sortColumn,
            direction: sortDirection,
          }
        : undefined,
      pagination: {
        pageIndex: currentPage,
        pageSize,
        totalItems,
        totalPages,
      },
      filters: state?.filters,
      search: state?.search,
    }),
    [currentPage, pageSize, sortColumn, sortDirection, totalItems, totalPages, state?.filters, state?.search],
  );

  const handleToggleAll = async () => {
    if (!isAllSelected && adapter?.mode === 'remote' && adapter.fetchFilteredIds) {
      const matchingIds = await adapter.fetchFilteredIds(query);
      handleSelectAll(true, matchingIds);
      return;
    }

    handleSelectAll(!isAllSelected);
  };

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    if (event.key === 'Escape') {
      clearSelection();
    }
  };

  const handleLoadMore = async () => {
    if (!remoteMode || remoteLoading || remoteHasNextPage === false) return;
    handlePageChange(currentPage + 1);
  };

  const openContextMenu = (event: React.MouseEvent, row: TData) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuState({
      rowId: row.id,
      x: event.clientX,
      y: event.clientY,
    });
    onStateChange?.onContextMenuChange?.({
      rowId: row.id,
      selectedIds: selectedRowIds,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const closeContextMenu = () => {
    setContextMenuState(null);
    onStateChange?.onContextMenuChange?.(null);
  };

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };
    const handleWindowClick = () => {
      if (contextMenuState) {
        closeContextMenu();
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('click', handleWindowClick);
    };
  }, [contextMenuState]);

  if (isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (remoteMode && remoteLoading && remoteRows.length === 0) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (remoteMode && remoteError) {
    return <div className="p-4 text-center text-red-600">{remoteError}</div>;
  }

  if (!remoteMode && (!data || data.length === 0)) {
    return emptyState ? <>{emptyState}</> : <div className="p-4 text-center text-gray-500">No data available</div>;
  }

  if (remoteMode && remoteRows.length === 0) {
    return emptyState ? <>{emptyState}</> : <div className="p-4 text-center text-gray-500">No data available</div>;
  }

  return (
    <div className="w-full flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto w-full" onKeyDown={handleCellKeyDown}>
        <table ref={tableRef} className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <TableHeader
            columns={columns}
            features={features}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSortChange={(colId) => handleSort(colId)}
            allSelected={isAllSelected}
            someSelected={isSomeSelected}
            onToggleAll={() => {
              void handleToggleAll();
            }}
            onToggleColumnVisibility={toggleColumnVisibility}
            onRenameColumn={renameColumn}
            onReorderColumn={reorderColumnById}
            onResizeColumn={resizeColumn}
          />
          <tbody className="divide-y divide-gray-100">
            {tableData.map((row, rowIndex) => (
              <TableRow
                key={row.id}
                row={row}
                rowIndex={rowIndex}
                columns={visibleColumns}
                features={features}
                tableRef={tableRef}
                isSelected={selectedRowIds.includes(row.id)}
                onToggleSelection={(id, meta) => handleSelectRow(id, !selectedRowIds.includes(id), meta)}
                onRowEdit={callbacks?.onRowEdit}
                onContextMenu={(event, currentRow) => {
                  callbacks?.onContextMenu?.(event, currentRow);
                  openContextMenu(event, currentRow);
                }}
                onRowDoubleClick={callbacks?.onRowDoubleClick}
                onRowDragStart={callbacks?.onRowDragStart}
                onClearSelection={clearSelection}
              />
            ))}
            {appendRow}
          </tbody>
        </table>
      </div>

      {contextMenuState && (rowActions.length > 0 || bulkActions.length > 0) && (
        <div
          className="fixed z-50 min-w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          style={{ left: contextMenuState.x, top: contextMenuState.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {contextMenuState.rowId ? 'Row actions' : 'Bulk actions'}
          </div>

          {contextMenuState.rowId &&
            rowActions.map((action) => {
              const row = tableData.find((item) => item.id === contextMenuState.rowId);
              if (!row) return null;
              const disabled = typeof action.disabled === 'function' ? action.disabled(row) : action.disabled;

              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={disabled}
                  onClick={async (event) => {
                    event.stopPropagation();
                    await action.run(row);
                    closeContextMenu();
                  }}
                  className="flex w-full items-center rounded px-2 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {action.label}
                </button>
              );
            })}

          {selectedRowIds.length > 0 && bulkActions.length > 0 && (
            <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-700">
              {bulkActions.map((action) => {
                const selectedRows = tableData.filter((row) => selectedRowIds.includes(row.id));
                const disabled =
                  typeof action.disabled === 'function' ? action.disabled(selectionState, selectedRows) : action.disabled;

                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={disabled}
                    onClick={async (event) => {
                      event.stopPropagation();
                      await action.run(selectionState, selectedRows);
                      closeContextMenu();
                    }}
                    className="flex w-full items-center rounded px-2 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {features?.pagination && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            {remoteMode
              ? `Loaded ${tableData.length}${typeof remoteTotalItems === 'number' ? ` of ${remoteTotalItems}` : ''}`
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, totalItems)} of ${totalItems}`}
          </span>
          <div className="flex items-center gap-2">
            {remoteMode ? (
              <button
                onClick={handleLoadMore}
                disabled={remoteLoading || remoteHasNextPage === false}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {remoteLoading ? 'Loading…' : remoteHasNextPage === false ? 'No more rows' : 'Load more'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default TableEngine;

