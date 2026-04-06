import React, { useMemo, useRef, useState } from 'react';
import { ColumnDef, TableData, TableFeatures } from '../types';

interface TableHeaderProps<TData extends TableData> {
  columns: ColumnDef<TData>[];
  features?: TableFeatures;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
  onSortChange?: (columnId: string, direction: 'asc' | 'desc' | null) => void;
  allSelected?: boolean;
  someSelected?: boolean;
  onToggleAll?: () => void;
  onToggleColumnVisibility?: (columnId: string) => void;
  onRenameColumn?: (columnId: string, label: string) => void;
  onReorderColumn?: (sourceColumnId: string, targetColumnId: string) => void;
  onResizeColumn?: (columnId: string, width: number) => void;
}

function columnLabel<TData extends TableData>(column: ColumnDef<TData>, override?: string) {
  if (override) return override;
  if (typeof column.header === 'string') return column.header;
  return column.id;
}

export function TableHeader<TData extends TableData>({
  columns,
  features,
  sortColumn,
  sortDirection,
  onSortChange,
  allSelected,
  someSelected,
  onToggleAll,
  onToggleColumnVisibility,
  onRenameColumn,
  onReorderColumn,
  onResizeColumn,
}: TableHeaderProps<TData>) {
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const dragColumnIdRef = useRef<string | null>(null);
  const resizeRef = useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const sortableColumns = useMemo(
    () => columns.filter((column) => column.visible !== false),
    [columns],
  );

  const handleSort = (columnId: string, sortable?: boolean) => {
    if (!features?.sorting || !sortable || !onSortChange) return;

    if (sortColumn === columnId) {
      if (sortDirection === 'asc') {
        onSortChange(columnId, 'desc');
      } else {
        onSortChange(columnId, null);
      }
    } else {
      onSortChange(columnId, 'asc');
    }
  };

  const startRename = (column: ColumnDef<TData>) => {
    if (column.renameable === false || (column.enableColumnCustomization === false && !features?.columnCustomization)) {
      return;
    }
    setRenamingColumnId(column.id);
    setDraftLabel(columnLabel(column));
  };

  const commitRename = (columnId: string) => {
    onRenameColumn?.(columnId, draftLabel.trim() || columnId);
    setRenamingColumnId(null);
    setDraftLabel('');
  };

  const startResize = (column: ColumnDef<TData>, event: React.PointerEvent<HTMLSpanElement>) => {
    if (column.resizable === false) return;
    const th = event.currentTarget.closest('th');
    if (!th) return;

    const startWidth = th.getBoundingClientRect().width;
    resizeRef.current = {
      columnId: column.id,
      startX: event.clientX,
      startWidth,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      if (!resizeRef.current || resizeRef.current.columnId !== column.id) return;
      const nextWidth = Math.max(72, resizeRef.current.startWidth + (moveEvent.clientX - resizeRef.current.startX));
      onResizeColumn?.(column.id, Math.round(nextWidth));
    };

    const handleUp = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 select-none">
      <tr>
        {features?.rowSelection && (
          <th scope="col" className="p-4 w-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={allSelected || false}
                ref={(input) => {
                  if (input) input.indeterminate = Boolean(someSelected && !allSelected);
                }}
                onChange={onToggleAll}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </th>
        )}
        {sortableColumns.map((column) => {
          const isSorted = sortColumn === column.id;
          const visibleLabel = columnLabel(column);
          const allowCustomization = features?.columnCustomization && column.enableColumnCustomization !== false;
          const showRenameInput = renamingColumnId === column.id;
          const widthStyle = column.width ? { width: column.width, minWidth: column.width } : undefined;

          return (
            <th
              key={column.id}
              scope="col"
              className={`relative px-6 py-3 align-middle ${
                features?.sorting && column.sortable !== false ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''
              } ${allowCustomization ? 'group' : ''}`}
              style={widthStyle}
              draggable={allowCustomization && column.draggable !== false}
              onDragStart={() => {
                dragColumnIdRef.current = column.id;
              }}
              onDragOver={(event) => {
                if (!allowCustomization) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                if (!allowCustomization) return;
                event.preventDefault();
                if (dragColumnIdRef.current && dragColumnIdRef.current !== column.id) {
                  onReorderColumn?.(dragColumnIdRef.current, column.id);
                }
                dragColumnIdRef.current = null;
              }}
              onClick={() => handleSort(column.id, column.sortable !== false)}
            >
              <div className="flex items-center gap-2 pr-6">
                {showRenameInput ? (
                  <input
                    autoFocus
                    value={draftLabel}
                    onChange={(event) => setDraftLabel(event.target.value)}
                    onBlur={() => commitRename(column.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitRename(column.id);
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setRenamingColumnId(null);
                        setDraftLabel('');
                      }
                    }}
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs uppercase tracking-wide text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                ) : (
                  <span
                    className="truncate"
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      startRename(column);
                    }}
                  >
                    {allowCustomization && onRenameColumn ? visibleLabel : column.header}
                  </span>
                )}

                {allowCustomization && onRenameColumn && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      startRename(column);
                    }}
                    className="opacity-0 transition-opacity group-hover:opacity-100 text-[10px] text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    aria-label={`Rename ${visibleLabel}`}
                  >
                    ✎
                  </button>
                )}

                {allowCustomization && onToggleColumnVisibility && !column.alwaysVisible && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleColumnVisibility(column.id);
                    }}
                    className="opacity-0 transition-opacity group-hover:opacity-100 text-[10px] text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    aria-label={`${column.visible === false ? 'Show' : 'Hide'} ${visibleLabel}`}
                  >
                    {column.visible === false ? '◔' : '◕'}
                  </button>
                )}

                {features?.sorting && column.sortable !== false && (
                  <span className="inline-flex flex-col ml-1 text-[10px] leading-none">
                    {isSorted && sortDirection === 'asc' ? '▲' : isSorted && sortDirection === 'desc' ? '▼' : '•'}
                  </span>
                )}
              </div>

              {allowCustomization && column.resizable !== false && onResizeColumn && (
                <span
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize opacity-0 group-hover:opacity-100 bg-blue-500/20"
                  onPointerDown={(event) => startResize(column, event)}
                  aria-hidden="true"
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
