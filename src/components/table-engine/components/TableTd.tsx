import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { WithId, ColDef, BadgeMeta } from '../types';
import { getColumnValue } from '../columnAccess';
import { TagChipDisplay, TagOptionMenu } from './TagOptionMenu';
import type { ResolvedTag, TagPatch } from '../tagOptions';

interface TableTdProps<TRow extends WithId> {
  colId: string;
  colDef: ColDef<TRow>;
  row: TRow;
  rowIndex: number;
  // Inline edit
  inlineEditCell: { id: string; field: string } | null;
  inlineEditValue: string;
  setInlineEditValue: (v: string) => void;
  inlineEditValueRef: React.MutableRefObject<string>;
  focusedCell: { rowIndex: number; colKey: string } | null;
  setFocusedCell: (v: { rowIndex: number; colKey: string } | null) => void;
  startInlineEdit: (id: string, field: string, value: string) => void;
  commitInlineEdit: (row: TRow) => void;
  cancelInlineEdit: () => void;
  inlineEditCellRef: React.MutableRefObject<{ id: string; field: string } | null>;
  handleCellBlur: (row: TRow) => void;
  handleCellKeyDown: (e: React.KeyboardEvent, row: TRow) => void;
  cellDisplay: (row: TRow, field: string, fallback: any) => any;
  displayVal: (v: any) => string | null;
  resolveTag: (columnId: string, option: string, base?: BadgeMeta) => ResolvedTag;
  onSaveTag: (columnId: string, option: string, patch: TagPatch) => void;
}

export function TableTd<TRow extends WithId>({
  colId, colDef, row, rowIndex,
  inlineEditCell, inlineEditValue, setInlineEditValue, inlineEditValueRef,
  focusedCell, setFocusedCell,
  startInlineEdit, commitInlineEdit, cancelInlineEdit, inlineEditCellRef,
  handleCellBlur, handleCellKeyDown, cellDisplay, displayVal,
  resolveTag, onSaveTag,
}: TableTdProps<TRow>) {
  const field = colDef.field as string;
  const isFocused = focusedCell?.rowIndex === rowIndex && focusedCell?.colKey === colId;
  const focusRing = isFocused ? ' ring-1 ring-inset ring-gray-300' : '';
  const isEditing = inlineEditCell?.id === row.id && inlineEditCell.field === field;
  const rawValue = getColumnValue(row, colDef);
  const displayValue = cellDisplay(row, field, rawValue);

  // ── Custom renderer ────────────────────────────────────────────────────────
  if (colDef.type === 'custom' && colDef.renderCell) {
    return (
      <td key={colId} data-col={colId} className={`px-3 py-4${focusRing} ${colDef.tdClassName ?? ''}`}>
        {colDef.renderCell(displayValue, row, {
          startEdit: startInlineEdit,
          isEditing: (id, f) => inlineEditCell?.id === id && inlineEditCell.field === f,
          inlineValue: inlineEditValue,
          setInlineValue: (v) => { setInlineEditValue(v); inlineEditValueRef.current = v; },
          commitEdit: commitInlineEdit,
          cancelEdit: cancelInlineEdit,
          cellDisplay, focusedCell, rowIndex,
          onBlur: handleCellBlur,
          onKeyDown: handleCellKeyDown,
        })}
      </td>
    );
  }

  // ── Badge dropdown ─────────────────────────────────────────────────────────
  if (colDef.type === 'badge' && colDef.badgeMeta) {
    const statusVal = String(displayValue ?? '');
    const hasVal = displayVal(statusVal) !== null;
    const metaKeys = Object.keys(colDef.badgeMeta);
    const base = hasVal
      ? (colDef.badgeMeta[statusVal] ?? colDef.badgeMeta[metaKeys[0]])
      : colDef.badgeMeta[metaKeys[0]];
    const tag = resolveTag(colId, statusVal, base);
    const options = colDef.enumOptions ?? [];
    return (
      <td key={colId} data-col={colId} className={`px-3 py-4${focusRing}`}>
        <div className="relative">
          <div className="inline-flex items-center rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-pointer"
            onClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(row.id, field, statusVal); }}>
            {!hasVal ? <span className="text-gray-300">---</span> : (
              <TagChipDisplay tag={tag} withChevron />
            )}
          </div>
          <AnimatePresence>
            {isEditing && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => cancelInlineEdit()} />
                <motion.div initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }} transition={{ duration: 0.12 }}
                  className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-30">
                  <TagOptionMenu
                    options={options}
                    selected={statusVal}
                    variant="badge"
                    resolve={(option) => resolveTag(colId, option, colDef.badgeMeta?.[option] ?? colDef.badgeMeta?.[metaKeys[0]])}
                    onSelect={(option) => {
                      inlineEditValueRef.current = option;
                      setInlineEditValue(option);
                      commitInlineEdit(row);
                    }}
                    onSave={(option, patch) => onSaveTag(colId, option, patch)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </td>
    );
  }

  // ── Enum dropdown ──────────────────────────────────────────────────────────
  if (colDef.type === 'enum' && colDef.enumOptions) {
    const val = String(displayValue ?? '');
    const tag = resolveTag(colId, val, undefined);
    return (
      <td key={colId} data-col={colId} className={`px-3 py-4${focusRing} ${colDef.tdClassName ?? ''}`}>
        <div className="relative">
          <div className="inline-flex items-center rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-pointer"
            onClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(row.id, field, val); }}>
            {displayVal(val) === null ? <span className="text-gray-300">---</span> : <span className="text-sm font-bold text-gray-900">{tag.label}</span>}
          </div>
          <AnimatePresence>
            {isEditing && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => cancelInlineEdit()} />
                <motion.div initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }} transition={{ duration: 0.12 }}
                  className="absolute left-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-30">
                  <TagOptionMenu
                    options={colDef.enumOptions}
                    selected={val}
                    variant="text"
                    resolve={(option) => resolveTag(colId, option, undefined)}
                    onSelect={(option) => {
                      inlineEditValueRef.current = option;
                      setInlineEditValue(option);
                      commitInlineEdit(row);
                    }}
                    onSave={(option, patch) => onSaveTag(colId, option, patch)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </td>
    );
  }

  // ── Number cell ────────────────────────────────────────────────────────────
  if (colDef.type === 'number') {
    const numVal = displayValue as number;
    const formatted = colDef.formatDisplay ? colDef.formatDisplay(numVal) : (numVal != null ? String(numVal) : null);
    return (
      <td key={colId} data-col={colId} className={`px-3 py-4 font-bold text-gray-900${focusRing} ${colDef.tdClassName ?? ''}`}>
        {isEditing ? (
          <input autoFocus type="number" value={inlineEditValue}
            onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
            onFocus={e => e.target.select()} onBlur={() => handleCellBlur(row)}
            onKeyDown={e => handleCellKeyDown(e, row)} onClick={e => e.stopPropagation()}
            className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-gray-400 font-bold text-gray-900 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        ) : (
          <div className="inline-block rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-text"
            onClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(row.id, field, String(rawValue ?? '')); }}>
            {formatted ?? <span className="text-gray-300">---</span>}
          </div>
        )}
      </td>
    );
  }

  // ── Text cell (default) ────────────────────────────────────────────────────
  return (
    <td key={colId} data-col={colId} className={`px-3 py-4 font-bold text-gray-900 overflow-hidden${focusRing} ${colDef.tdClassName ?? ''}`}>
      {isEditing ? (
        <input autoFocus value={inlineEditValue} maxLength={100}
          onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
          onFocus={e => e.target.select()} onBlur={() => handleCellBlur(row)}
          onKeyDown={e => handleCellKeyDown(e, row)} onClick={e => e.stopPropagation()}
          className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-gray-400 font-bold text-gray-900 text-sm" />
      ) : (
        <div className="inline-block max-w-full truncate rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-text"
          onClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(row.id, field, String(rawValue ?? '')); }}>
          {displayVal(displayValue) ?? <span className="text-gray-300">---</span>}
        </div>
      )}
    </td>
  );
}
