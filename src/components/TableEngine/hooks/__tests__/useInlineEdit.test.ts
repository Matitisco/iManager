import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useInlineEdit } from '../useInlineEdit';

describe('useInlineEdit', () => {
  it('should initialize correctly', () => {
    const { result } = renderHook(() => useInlineEdit());
    expect(result.current.editingCell).toBeNull();
    expect(result.current.editValue).toBeNull();
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should start editing and cancel editing', () => {
    const { result } = renderHook(() => useInlineEdit());
    
    act(() => {
      result.current.startEditing('row1', 'col1', 'initial value');
    });

    expect(result.current.editingCell).toEqual({ rowId: 'row1', columnId: 'col1' });
    expect(result.current.editValue).toBe('initial value');
    expect(result.current.error).toBeNull();

    act(() => {
      result.current.setEditValue('new value');
    });
    
    expect(result.current.editValue).toBe('new value');

    act(() => {
      result.current.cancelEditing();
    });

    expect(result.current.editingCell).toBeNull();
    expect(result.current.editValue).toBeNull();
  });

  it('should save edit successfully', async () => {
    const onRowEdit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInlineEdit(onRowEdit));
    
    act(() => {
      result.current.startEditing('row1', 'col1', 'initial value');
    });

    act(() => {
      result.current.setEditValue('new value');
    });

    await act(async () => {
      await result.current.saveEdit({ id: 'row1', col1: 'old value' });
    });

    expect(onRowEdit).toHaveBeenCalledWith({ id: 'row1', col1: 'old value' }, 'col1', 'new value');
    expect(result.current.editingCell).toBeNull(); // editing should be cancelled on success
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle save error', async () => {
    const error = new Error('Save failed');
    const onRowEdit = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useInlineEdit(onRowEdit));
    
    act(() => {
      result.current.startEditing('row1', 'col1', 'initial value');
    });

    await act(async () => {
      await result.current.saveEdit({ id: 'row1' });
    });

    expect(result.current.editingCell).toEqual({ rowId: 'row1', columnId: 'col1' }); // keep editing on error
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBe('Save failed');
  });

  it('should cancel if save called without editing state', async () => {
    const onRowEdit = vi.fn();
    const { result } = renderHook(() => useInlineEdit(onRowEdit));
    
    await act(async () => {
      await result.current.saveEdit({ id: 'row1' });
    });

    expect(onRowEdit).not.toHaveBeenCalled();
    expect(result.current.editingCell).toBeNull();
  });
});
