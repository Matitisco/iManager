import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import type { WithId, ColDef } from '../types';

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
}

export function TableTd<TRow extends WithId>({
  colId, colDef, row, rowIndex,
  inlineEditCell, inlineEditValue, setInlineEditValue, inlineEditValueRef,
  focusedCell, setFocusedCell,
  startInlineEdit, commitInlineEdit, cancelInlineEdit, inlineEditCellRef,
  handleCellBlur, handleCellKeyDown, cellDisplay, displayVal,
}: TableTdProps<TRow>) {
  const field = colDef.field as string;
  const isFocused = focusedCell?.rowIndex === rowIndex && focusedCell?.colKey === colId;
  const focusRing = isFocused ? ' ring-1 ring-inset ring-gray-300' : '';
  const isEditing = inlineEditCell?.id === row.id && inlineEditCell.field === field;
  const rawValue = (row as any)[field];
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
    const meta = hasVal ? (colDef.badgeMeta[statusVal] ?? colDef.badgeMeta[metaKeys[0]]) : colDef.badgeMeta[metaKeys[0]];
    const cancel = (e?: React.MouseEvent) => { e?.stopPropagation(); inlineEditCellRef.current = null; setInlineEditCell(null); };
    // Fix: need setInlineEditCell passed in — we use cancelInlineEdit instead for cancel
    return (
      <td key={colId} data-col={colId} className={`px-3 py-4${focusRing}`}>
        <div className="relative">
          <div className="inline-flex items-center rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-pointer"
            onClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(row.id, field, statusVal); }}>
            {!hasVal ? <span className="text-gray-300">---</span> : (
              <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wide ${meta.bg} ${meta.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
                {meta.label}
                <ChevronDown size={9} className="opacity-50 flex-shrink-0" />
              </span>
            )}
          </div>
          <AnimatePresence>
            {isEditing && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => cancelInlineEdit()} />
                <motion.div initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }} transition={{ duration: 0.12 }}
                  className="absolute left-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-30">
                  <div className="p-1">
                    {(colDef.enumOptions ?? []).map(opt => {
                      const m = colDef.badgeMeta![opt] ?? colDef.badgeMeta![metaKeys[0]];
                      const selected = opt === statusVal;
                      return (
                        <button key={opt}
                          onClick={e => { e.stopPropagation(); inlineEditValueRef.current = opt; setInlineEditValue(opt); commitInlineEdit(row); }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-colors ${selected ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                          <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wide ${m.bg} ${m.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />{m.label}
                          </span>
                          {selected && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />}
                        </button>
                      );
                    })}
                  </div>
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
    return (
      <td key={colId} data-col={colId} className={`px-3 py-4${focusRing} ${colDef.tdClassName ?? ''}`}>
        <div className="relative">
          <div className="inline-flex items-center rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-pointer"
            onClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(row.id, field, val); }}>
            {displayVal(val) === null ? <span className="text-gray-300">---</span> : <span className="text-sm font-medium text-gray-700">{val}</span>}
          </div>
          <AnimatePresence>
            {isEditing && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => cancelInlineEdit()} />
                <motion.div initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }} transition={{ duration: 0.12 }}
                  className="absolute left-0 top-full mt-1.5 w-40 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-30">
                  <div className="p-1">
                    {colDef.enumOptions.map(opt => (
                      <button key={opt} onClick={e => { e.stopPropagation(); inlineEditValueRef.current = opt; setInlineEditValue(opt); commitInlineEdit(row); }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${opt === val ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'}`}>{opt}</button>
                    ))}
                  </div>
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
    const formatted = colDef.formatDisplay ? colDef.formatDisplay(numVal) : (numVal != null ? `$${Number(numVal).toLocaleString('en-US')}` : null);
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
    <td key={colId} data-col={colId} className={`px-3 py-4 text-gray-700 overflow-hidden${focusRing} ${colDef.tdClassName ?? ''}`}>
      {isEditing ? (
        <input autoFocus value={inlineEditValue} maxLength={100}
          onChange={e => { setInlineEditValue(e.target.value); inlineEditValueRef.current = e.target.value; }}
          onFocus={e => e.target.select()} onBlur={() => handleCellBlur(row)}
          onKeyDown={e => handleCellKeyDown(e, row)} onClick={e => e.stopPropagation()}
          className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-gray-400 text-gray-700 text-sm" />
      ) : (
        <div className="truncate rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-text"
          onClick={e => { e.stopPropagation(); setFocusedCell(null); startInlineEdit(row.id, field, String(rawValue ?? '')); }}>
          {displayVal(displayValue) ?? <span className="text-gray-300">---</span>}
        </div>
      )}
    </td>
  );
}

// Helper to silence the missing setInlineEditCell in cancel for badge
function setInlineEditCell(_: null) {}
