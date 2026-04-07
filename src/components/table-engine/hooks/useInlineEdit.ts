import { useState, useRef } from 'react';
import type { WithId, ColDef } from '../types';

export function useInlineEdit<TRow extends WithId>(
  items: TRow[],
  columns: ColDef<TRow>[],
  orderedVisibleCols: string[],
  onUpdate: (item: TRow) => Promise<void>,
  setItems: React.Dispatch<React.SetStateAction<TRow[]>>
) {
  const COL_TO_FIELD = Object.fromEntries(columns.map(c => [c.id, c.field as string]));
  const FIELD_TO_COL = Object.fromEntries(columns.map(c => [c.field as string, c.id]));
  const EDITABLE_COLS = new Set(columns.filter(c => c.editable !== false).map(c => c.id));

  const [inlineEditCell, setInlineEditCell] = useState<{ id: string; field: string } | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; colKey: string } | null>(null);

  const inlineEditCellRef = useRef<{ id: string; field: string } | null>(null);
  const inlineEditValueRef = useRef('');
  const navigatingRef = useRef(false);
  const committedDisplayRef = useRef<{ id: string; field: string; value: any } | null>(null);

  const startInlineEdit = (id: string, field: string, value: string) => {
    inlineEditCellRef.current = { id, field };
    inlineEditValueRef.current = value;
    setInlineEditCell({ id, field });
    setInlineEditValue(value);
  };

  const cancelInlineEdit = () => {
    inlineEditCellRef.current = null;
    setInlineEditCell(null);
  };

  const commitInlineEdit = async (row: TRow) => {
    const cell = inlineEditCellRef.current;
    if (!cell) return;
    const { field } = cell;
    const newVal = inlineEditValueRef.current.trim();
    inlineEditCellRef.current = null;
    const currentVal = String((row as any)[field] ?? '');
    if (currentVal === newVal) { setInlineEditCell(null); return; }
    const colDef = columns.find(c => c.field === field);
    let parsed: any = newVal;
    if (colDef?.type === 'number') parsed = Number(newVal) || 0;
    committedDisplayRef.current = { id: row.id, field, value: parsed };
    setInlineEditCell(null);
    const updatedItem = { ...row, [field]: parsed };
    try {
      await onUpdate(updatedItem);
      setItems(prev => prev.map(p => p.id === row.id ? updatedItem : p));
    } finally {
      committedDisplayRef.current = null;
    }
  };

  const cellDisplay = (row: TRow, field: string, fallback: any) =>
    committedDisplayRef.current?.id === row.id && committedDisplayRef.current.field === field
      ? committedDisplayRef.current.value
      : fallback;

  const displayVal = (v: any): string | null =>
    v === null || v === undefined || v === '' ? null : String(v);

  const handleCellBlur = (row: TRow) => {
    if (navigatingRef.current) { navigatingRef.current = false; return; }
    commitInlineEdit(row);
  };

  const navigateFrom = (currentId: string, currentField: string, dir: 'tab' | 'shift-tab' | 'enter' | 'down' | 'up') => {
    const currentColId = FIELD_TO_COL[currentField];
    if (!currentColId) return;
    const editableCols = orderedVisibleCols.filter(c => EDITABLE_COLS.has(c));
    const rowIdx = items.findIndex(i => i.id === currentId);
    const colIdx = editableCols.indexOf(currentColId);
    if (rowIdx === -1 || colIdx === -1) return;
    let nextRowIdx = rowIdx, nextColIdx = colIdx, openEdit = true;
    if (dir === 'tab') { nextColIdx++; if (nextColIdx >= editableCols.length) { nextColIdx = 0; nextRowIdx++; } }
    else if (dir === 'shift-tab') { nextColIdx--; if (nextColIdx < 0) { nextColIdx = editableCols.length - 1; nextRowIdx--; } }
    else if (dir === 'enter') { nextRowIdx++; }
    else if (dir === 'down') { nextRowIdx++; openEdit = false; }
    else if (dir === 'up') { nextRowIdx--; openEdit = false; }
    if (nextRowIdx < 0 || nextRowIdx >= items.length) return;
    if (nextColIdx < 0 || nextColIdx >= editableCols.length) return;
    const nextItem = items[nextRowIdx];
    const nextColId = editableCols[nextColIdx];
    const nextField = COL_TO_FIELD[nextColId];
    if (!nextField) return;
    if (openEdit) startInlineEdit(nextItem.id, nextField, String((nextItem as any)[nextField] ?? ''));
    else setFocusedCell({ rowIndex: nextRowIdx, colKey: nextColId });
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, row: TRow) => {
    const cell = inlineEditCellRef.current;
    if (!cell) return;
    if (e.key === 'Tab') { e.preventDefault(); navigatingRef.current = true; commitInlineEdit(row); navigateFrom(cell.id, cell.field, e.shiftKey ? 'shift-tab' : 'tab'); }
    else if (e.key === 'Enter') { e.preventDefault(); navigatingRef.current = true; commitInlineEdit(row); navigateFrom(cell.id, cell.field, 'enter'); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); navigatingRef.current = true; commitInlineEdit(row); navigateFrom(cell.id, cell.field, 'down'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); navigatingRef.current = true; commitInlineEdit(row); navigateFrom(cell.id, cell.field, 'up'); }
    else if (e.key === 'Escape') {
      e.preventDefault();
      const rowIndex = items.findIndex(i => i.id === cell.id);
      const colKey = FIELD_TO_COL[cell.field];
      if (rowIndex !== -1 && colKey) setFocusedCell({ rowIndex, colKey });
      cancelInlineEdit();
    }
  };

  return {
    inlineEditCell, inlineEditValue, setInlineEditValue,
    inlineEditCellRef, inlineEditValueRef,
    focusedCell, setFocusedCell,
    EDITABLE_COLS, COL_TO_FIELD, FIELD_TO_COL,
    startInlineEdit, cancelInlineEdit, commitInlineEdit,
    cellDisplay, displayVal, handleCellBlur, handleCellKeyDown,
  };
}
