import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnDef, TableData, TableFeatures } from '../types';

interface TableCellProps<TData extends TableData> {
  row: TData;
  rowIndex: number;
  column: ColumnDef<TData>;
  columnIndex: number;
  features?: TableFeatures;
  tableRef?: React.RefObject<HTMLTableElement>;
  onEdit?: (row: TData, field: string, value: unknown) => Promise<void> | void;
  onClearSelection?: () => void;
}

function isValueMissing(value: unknown) {
  return value === null || value === undefined || value === '';
}

function readCellValue<TData extends TableData>(row: TData, column: ColumnDef<TData>) {
  if (column.accessorFn) return column.accessorFn(row);
  if (!column.accessorKey) return undefined;
  return row[column.accessorKey as keyof TData];
}

export function TableCell<TData extends TableData>({
  row,
  rowIndex,
  column,
  columnIndex,
  features,
  tableRef,
  onEdit,
  onClearSelection,
}: TableCellProps<TData>) {
  const cellValue = readCellValue(row, column);
  const placeholderConfig = column.placeholder;
  const isEditable = Boolean(features?.inlineEditing && column.editable !== false && (column.accessorKey || column.accessorFn));
  const isEnumColumn = column.type === 'enum' || column.rendererKey === 'enum' || column.editorKey === 'enum';

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<unknown>(cellValue);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  useEffect(() => {
    setEditValue(cellValue);
  }, [cellValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current && typeof inputRef.current.select === 'function') {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const placeholderValue = useMemo(() => {
    if (!placeholderConfig) return null;
    if (isValueMissing(cellValue) || (placeholderConfig.treatEmptyStringAsMissing && cellValue === '')) {
      return placeholderConfig.value ?? '---';
    }
    return null;
  }, [cellValue, placeholderConfig]);

  const commit = async () => {
    if (!isEditing) return;
    setIsEditing(false);
    if (editValue !== cellValue && onEdit && (column.accessorKey || column.accessorFn)) {
      await onEdit(row, String(column.accessorKey ?? column.id), editValue);
    } else {
      setEditValue(cellValue);
    }
  };

  const cancel = () => {
    setIsEditing(false);
    setEditValue(cellValue);
  };

  const focusFlatCell = (offset: number) => {
    const table = tableRef?.current;
    if (!table) return;

    const cells = Array.from(table.querySelectorAll<HTMLTableCellElement>('td[data-table-cell="true"]'));
    const currentIndex = cells.findIndex(
      (cell) =>
        Number(cell.dataset.rowIndex) === rowIndex &&
        Number(cell.dataset.columnIndex) === columnIndex,
    );
    const nextCell = cells[currentIndex + offset];
    nextCell?.focus();
  };

  const moveFocus = (deltaRow: number, deltaColumn: number) => {
    const table = tableRef?.current;
    if (!table) return;

    const nextRowIndex = rowIndex + deltaRow;
    const nextColumnIndex = columnIndex + deltaColumn;
    const nextCell = table.querySelector<HTMLTableCellElement>(
      `td[data-table-cell="true"][data-row-index="${nextRowIndex}"][data-column-index="${nextColumnIndex}"]`,
    );

    nextCell?.focus();
  };

  const handleDisplayKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>) => {
    if (!isEditable) {
      if (event.key === 'Escape') {
        onClearSelection?.();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveFocus(0, 1);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveFocus(0, -1);
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveFocus(1, 0);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveFocus(-1, 0);
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        focusFlatCell(event.shiftKey ? -1 : 1);
      }
      if (event.key === 'Enter' || event.key === 'F2') {
        event.preventDefault();
        setIsEditing(true);
      }
    }
  };

  const handleDisplayClick = (event: React.MouseEvent<HTMLTableCellElement>) => {
    event.stopPropagation();
    if (!isEditable) return;
    if (isEnumColumn || isValueMissing(cellValue)) {
      setIsEditing(true);
    }
  };

  const handleDisplayDoubleClick = (event: React.MouseEvent<HTMLTableCellElement>) => {
    event.stopPropagation();
    if (!isEditable) return;
    if (!isEnumColumn) {
      setIsEditing(true);
    }
  };

  if (isEditing) {
    if (isEnumColumn && Array.isArray(column.enumOptions?.length ? column.enumOptions : column.options)) {
      const options = column.enumOptions?.length
        ? column.enumOptions
        : (column.options ?? []).map((option) => ({ label: option, value: option }));

      return (
        <td className={`${column.className || 'px-6 py-4'} bg-blue-50 dark:bg-blue-900/20`}>
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={(editValue as string) ?? ''}
            onChange={(event) => setEditValue(event.target.value)}
            onBlur={commit}
            onKeyDown={async (event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                cancel();
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                await commit();
              }
            }}
            className="w-full rounded-lg border border-gray-300 bg-white p-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        </td>
      );
    }

    return (
      <td className={`${column.className || 'px-6 py-4'} bg-blue-50 dark:bg-blue-900/20`}>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={column.type === 'number' || column.type === 'currency' ? 'number' : 'text'}
          value={(editValue as string | number | readonly string[] | undefined) ?? ''}
          onChange={(event) => setEditValue(event.target.value)}
          onBlur={commit}
          onKeyDown={async (event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              cancel();
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              await commit();
            }
          }}
          className="w-full rounded-lg border border-gray-300 bg-white p-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </td>
    );
  }

  if (column.cell) {
    return (
      <td
        tabIndex={0}
        data-table-cell="true"
        data-row-index={rowIndex}
        data-column-index={columnIndex}
        className={`${column.className || 'px-6 py-4'} outline-none ${isEditable ? 'cursor-pointer' : ''}`}
        onClick={handleDisplayClick}
        onDoubleClick={handleDisplayDoubleClick}
        onKeyDown={handleDisplayKeyDown}
      >
        {column.cell({
          column,
          row,
          value: cellValue,
          rowIndex,
          isEditing: false,
          placeholder: placeholderValue,
        })}
      </td>
    );
  }

  let displayValue: React.ReactNode = cellValue as React.ReactNode;
  if (placeholderValue !== null) {
    displayValue = placeholderValue;
  } else if (isEnumColumn) {
    const matched = column.enumOptions?.find((option) => option.value === cellValue)
      ?? (column.options?.includes(String(cellValue)) ? { label: cellValue as React.ReactNode, value: String(cellValue) } : undefined);
    displayValue = matched?.label ?? cellValue as React.ReactNode;
  } else if (column.type === 'currency' && typeof cellValue === 'number') {
    displayValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cellValue);
  } else if (column.type === 'date' && cellValue) {
    displayValue = new Date(cellValue as string | number | Date).toLocaleDateString();
  }

  return (
    <td
        tabIndex={0}
      data-table-cell="true"
      data-row-index={rowIndex}
      data-column-index={columnIndex}
      className={`${column.className || 'px-6 py-4'} outline-none ${isEditable ? 'cursor-pointer' : ''}`}
      onClick={handleDisplayClick}
      onDoubleClick={handleDisplayDoubleClick}
      onKeyDown={handleDisplayKeyDown}
      title={isEditable ? 'Click or double click to edit' : undefined}
    >
      {displayValue}
    </td>
  );
}
