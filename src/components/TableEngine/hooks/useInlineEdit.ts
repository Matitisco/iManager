import { useState } from 'react';
import { TableData } from '../types';

export function useInlineEdit<TData extends TableData>(
  onRowEdit?: (row: TData, field: string, value: any) => Promise<void> | void
) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = (rowId: string, columnId: string, initialValue: any) => {
    setEditingCell({ rowId, columnId });
    setEditValue(initialValue);
    setError(null);
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue(null);
    setError(null);
  };

  const saveEdit = async (row: TData) => {
    if (!editingCell || !onRowEdit) {
      cancelEditing();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onRowEdit(row, editingCell.columnId, editValue);
      cancelEditing();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    editingCell,
    editValue,
    setEditValue,
    isSaving,
    error,
    startEditing,
    cancelEditing,
    saveEdit,
  };
}
