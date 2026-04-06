import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useColumnCustomization } from '../useColumnCustomization';
import { ColumnDef } from '../../types';

const initialColumns: ColumnDef<any>[] = [
  { id: 'col1', header: 'Col 1', visible: true },
  { id: 'col2', header: 'Col 2', visible: false },
  { id: 'col3', header: 'Col 3' }, // Default visible is true conceptually, we check if it !== false
];

describe('useColumnCustomization', () => {
  it('should initialize correctly with visible columns', () => {
    const { result } = renderHook(() => useColumnCustomization(initialColumns));

    expect(result.current.columns).toEqual([
      { id: 'col1', header: 'Col 1', visible: true, width: undefined },
      { id: 'col2', header: 'Col 2', visible: false, width: undefined },
      { id: 'col3', header: 'Col 3', visible: true, width: undefined },
    ]);
    expect(result.current.visibleColumns.length).toBe(2);
    expect(result.current.visibleColumns[0].id).toBe('col1');
    expect(result.current.visibleColumns[1].id).toBe('col3');
  });

  it('should toggle column visibility', () => {
    const { result } = renderHook(() => useColumnCustomization(initialColumns));
    
    act(() => {
      result.current.toggleColumnVisibility('col1'); // true -> false
    });

    expect(result.current.visibleColumns.length).toBe(1);
    expect(result.current.visibleColumns[0].id).toBe('col3');

    act(() => {
      result.current.toggleColumnVisibility('col2'); // false -> true
    });

    expect(result.current.visibleColumns.length).toBe(2);
    expect(result.current.visibleColumns.find(c => c.id === 'col2')).toBeDefined();
  });

  it('should reorder columns', () => {
    const { result } = renderHook(() => useColumnCustomization(initialColumns));
    
    act(() => {
      result.current.reorderColumn(0, 2); // move col1 to end
    });

    expect(result.current.columns[0].id).toBe('col2');
    expect(result.current.columns[1].id).toBe('col3');
    expect(result.current.columns[2].id).toBe('col1');
  });

  it('should resize columns', () => {
    const { result } = renderHook(() => useColumnCustomization(initialColumns));
    
    act(() => {
      result.current.resizeColumn('col1', 150);
    });

    expect(result.current.columns[0].width).toBe(150);
  });
});
