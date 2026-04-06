import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTablePagination } from '../useTablePagination';

const generateData = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({ id: `${i}`, val: i }));
};

describe('useTablePagination', () => {
  it('should return initial page and size correctly', () => {
    const data = generateData(25);
    const { result } = renderHook(() => useTablePagination(data, 1, 10));
    
    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.totalItems).toBe(25);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.paginatedData.length).toBe(10);
    expect(result.current.paginatedData[0].val).toBe(0);
  });

  it('should handle page changes', () => {
    const data = generateData(25);
    const onPageChange = vi.fn();
    const { result } = renderHook(() => useTablePagination(data, 1, 10, onPageChange));
    
    act(() => {
      result.current.handlePageChange(2);
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedData.length).toBe(10);
    expect(result.current.paginatedData[0].val).toBe(10);
    expect(onPageChange).toHaveBeenCalledWith(2, 10);
  });

  it('should cap page changes to bounds', () => {
    const data = generateData(25);
    const { result } = renderHook(() => useTablePagination(data, 1, 10));
    
    act(() => {
      result.current.handlePageChange(5); // Out of bounds
    });

    expect(result.current.currentPage).toBe(3); // Max pages is 3

    act(() => {
      result.current.handlePageChange(-1); // Out of bounds
    });

    expect(result.current.currentPage).toBe(1); // Min page is 1
  });

  it('should handle page size changes and reset to first page', () => {
    const data = generateData(25);
    const onPageChange = vi.fn();
    // Start at page 2
    const { result } = renderHook(() => useTablePagination(data, 2, 10, onPageChange));
    
    act(() => {
      result.current.handlePageSizeChange(20);
    });

    expect(result.current.pageSize).toBe(20);
    expect(result.current.currentPage).toBe(1); // Should reset to 1
    expect(result.current.totalPages).toBe(2);
    expect(result.current.paginatedData.length).toBe(20);
    expect(onPageChange).toHaveBeenCalledWith(1, 20);
  });
});
