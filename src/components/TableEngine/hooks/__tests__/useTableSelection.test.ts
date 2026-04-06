import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTableSelection } from '../useTableSelection';

const data = [
  { id: '1', name: 'A' },
  { id: '2', name: 'B' },
  { id: '3', name: 'C' },
];

describe('useTableSelection', () => {
  it('should initialize with empty selection', () => {
    const { result } = renderHook(() => useTableSelection(data));
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isSomeSelected).toBe(false);
  });

  it('should handle select all and clear selection', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() => useTableSelection(data, onSelectionChange));

    act(() => {
      result.current.handleSelectAll(true);
    });

    expect(result.current.selectedIds).toEqual(['1', '2', '3']);
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.isSomeSelected).toBe(false);
    expect(onSelectionChange).toHaveBeenCalledWith(['1', '2', '3']);

    act(() => {
      result.current.handleSelectAll(false);
    });

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isSomeSelected).toBe(false);
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('should handle selecting and deselecting individual rows', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() => useTableSelection(data, onSelectionChange));

    act(() => {
      result.current.handleSelectRow('2', true);
    });

    expect(result.current.selectedIds).toEqual(['2']);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isSomeSelected).toBe(true);
    expect(onSelectionChange).toHaveBeenCalledWith(['2']);

    act(() => {
      result.current.handleSelectRow('2', false);
    });

    expect(result.current.selectedIds).toEqual([]);
  });
});
