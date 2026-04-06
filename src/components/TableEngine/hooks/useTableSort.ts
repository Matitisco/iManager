import { useState, useMemo } from 'react';
import { ColumnDef, TableData } from '../types';

export function useTableSort<TData extends TableData>(
  data: TData[],
  columns: ColumnDef<TData>[],
  initialSortColumn?: string,
  initialSortDirection: 'asc' | 'desc' | null = null,
  onSortChange?: (columnId: string, direction: 'asc' | 'desc' | null) => void
) {
  const [sortColumn, setSortColumn] = useState<string | null>(initialSortColumn || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(initialSortDirection);

  const handleSort = (columnId: string) => {
    let newDirection: 'asc' | 'desc' | null = 'asc';
    
    if (sortColumn === columnId) {
      if (sortDirection === 'asc') newDirection = 'desc';
      else if (sortDirection === 'desc') newDirection = null;
    }

    setSortColumn(newDirection ? columnId : null);
    setSortDirection(newDirection);

    if (onSortChange) {
      onSortChange(columnId, newDirection);
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    const column = columns.find((col) => col.id === sortColumn);
    if (!column || !column.sortable) return data;

    return [...data].sort((a, b) => {
      const valA = column.accessorFn
        ? column.accessorFn(a)
        : column.accessorKey
          ? a[column.accessorKey as keyof TData]
          : a[column.id as keyof TData];
      const valB = column.accessorFn
        ? column.accessorFn(b)
        : column.accessorKey
          ? b[column.accessorKey as keyof TData]
          : b[column.id as keyof TData];

      let normalizedA: any = valA;
      let normalizedB: any = valB;

      if (normalizedA == null) normalizedA = '';
      if (normalizedB == null) normalizedB = '';

      if (typeof normalizedA === 'string' && typeof normalizedB === 'string') {
        const comparison = normalizedA.localeCompare(normalizedB);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (normalizedA === normalizedB) return 0;
      
      const comparison = normalizedA > normalizedB ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, columns, sortColumn, sortDirection]);

  return {
    sortedData,
    sortColumn,
    sortDirection,
    handleSort,
  };
}
