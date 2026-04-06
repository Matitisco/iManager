import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTableSort } from '../useTableSort';
import { ColumnDef } from '../../types';

const data = [
  { id: '1', name: 'Zebra', age: 10 },
  { id: '2', name: 'Alpha', age: 5 },
  { id: '3', name: 'Delta', age: 8 },
];

const columns: ColumnDef<any>[] = [
  { id: 'name', header: 'Name', sortable: true },
  { id: 'age', header: 'Age', sortable: true },
];

describe('useTableSort', () => {
  it('should return initial data when no sort is applied', () => {
    const { result } = renderHook(() => useTableSort(data, columns));
    expect(result.current.sortedData).toEqual(data);
    expect(result.current.sortColumn).toBeNull();
    expect(result.current.sortDirection).toBeNull();
  });

  it('should sort data by a given column in ascending order', () => {
    const { result } = renderHook(() => useTableSort(data, columns));
    
    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.sortColumn).toBe('name');
    expect(result.current.sortDirection).toBe('asc');
    expect(result.current.sortedData[0].name).toBe('Alpha');
    expect(result.current.sortedData[1].name).toBe('Delta');
    expect(result.current.sortedData[2].name).toBe('Zebra');
  });

  it('should toggle sort direction when sorting the same column again', () => {
    const { result } = renderHook(() => useTableSort(data, columns));
    
    act(() => {
      result.current.handleSort('name'); // asc
    });
    
    act(() => {
      result.current.handleSort('name'); // desc
    });

    expect(result.current.sortColumn).toBe('name');
    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.sortedData[0].name).toBe('Zebra');
    expect(result.current.sortedData[2].name).toBe('Alpha');
  });

  it('should clear sort when sorting a desc column again', () => {
    const { result } = renderHook(() => useTableSort(data, columns));
    
    act(() => result.current.handleSort('name')); // asc
    act(() => result.current.handleSort('name')); // desc
    act(() => result.current.handleSort('name')); // clear

    expect(result.current.sortColumn).toBeNull();
    expect(result.current.sortDirection).toBeNull();
    expect(result.current.sortedData).toEqual(data); // Initial order
  });

  it('should call onSortChange callback when sorting changes', () => {
    const onSortChange = vi.fn();
    const { result } = renderHook(() => useTableSort(data, columns, undefined, null, onSortChange));
    
    act(() => result.current.handleSort('name')); // asc
    expect(onSortChange).toHaveBeenCalledWith('name', 'asc');

    act(() => result.current.handleSort('name')); // desc
    expect(onSortChange).toHaveBeenCalledWith('name', 'desc');

    act(() => result.current.handleSort('name')); // clear
    expect(onSortChange).toHaveBeenCalledWith('name', null);
  });
});
