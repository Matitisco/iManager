import React from 'react';
import { ColumnDef, TableData, TableFeatures } from '../types';
import { TableCell } from './TableCell';

interface TableRowProps<TData extends TableData> {
  row: TData;
  rowIndex: number;
  columns: ColumnDef<TData>[];
  features?: TableFeatures;
  tableRef?: React.RefObject<HTMLTableElement>;
  isSelected?: boolean;
  onToggleSelection?: (id: string, meta?: { shiftKey?: boolean }) => void;
  onRowEdit?: (row: TData, field: string, value: unknown) => Promise<void> | void;
  onContextMenu?: (e: React.MouseEvent, row: TData) => void;
  onRowDoubleClick?: (e: React.MouseEvent, row: TData) => void;
  onRowDragStart?: (e: React.PointerEvent, row: TData) => void;
  onClearSelection?: () => void;
}

export function TableRow<TData extends TableData>({
  row,
  rowIndex,
  columns,
  features,
  tableRef,
  isSelected,
  onToggleSelection,
  onRowEdit,
  onContextMenu,
  onRowDoubleClick,
  onRowDragStart,
  onClearSelection,
}: TableRowProps<TData>) {
  return (
    <tr
      className={`bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
      onContextMenu={(e) => {
        if (features?.contextMenu && onContextMenu) onContextMenu(e, row);
      }}
      onDoubleClick={(e) => {
        if (onRowDoubleClick) onRowDoubleClick(e, row);
      }}
      onPointerDown={(e) => {
        if (features?.dragAndDrop && onRowDragStart) {
          const target = e.target as HTMLElement;
          const inputEl = target.closest('input') as HTMLInputElement | null;
          if (target.closest('button, select') || (inputEl && inputEl.type !== 'checkbox')) return;
          onRowDragStart(e, row);
        }
      }}
    >
      {features?.rowSelection && (
        <td className="w-4 p-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={isSelected || false}
              onClick={(event) => onToggleSelection?.(row.id, { shiftKey: event.shiftKey })}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </td>
      )}
      {columns.map((column, columnIndex) => {
        if (column.visible === false) return null;

        return (
          <TableCell
            key={`${row.id}-${column.id}`}
            row={row}
            rowIndex={rowIndex}
            column={column}
            columnIndex={columnIndex}
            features={features}
            tableRef={tableRef}
            onEdit={onRowEdit}
            onClearSelection={onClearSelection}
          />
        );
      })}
    </tr>
  );
}
