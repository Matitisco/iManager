import { useState, useMemo } from 'react';
import { TableData } from '../types';

export function useTablePagination<TData extends TableData>(
  data: TData[],
  initialPage = 1,
  initialPageSize = 10,
  onPageChange?: (page: number, pageSize: number) => void
) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(newPage);
    if (onPageChange) {
      onPageChange(newPage, pageSize);
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
    if (onPageChange) {
      onPageChange(1, size);
    }
  };

  return {
    paginatedData,
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    handlePageChange,
    handlePageSizeChange,
  };
}
