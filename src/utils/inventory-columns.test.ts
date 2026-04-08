/**
 * Tests that enforce the column layout contract of the TableEngine table.
 *
 * Columns use `table-fixed` + pointer-event resize/reorder handles.
 * Widths driven by `colWidths` state (localStorage-persisted).
 * Order driven by `colOrder` state. Names overrideable via `colNames`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcTableEngine = readFileSync(join(__dirname, '../components/table-engine/TableEngine.tsx'), 'utf-8');
const srcTableTh = readFileSync(join(__dirname, '../components/table-engine/components/TableTh.tsx'), 'utf-8');
const srcColStateHook = readFileSync(join(__dirname, '../components/table-engine/hooks/useColumnState.ts'), 'utf-8');
const srcTableTd = readFileSync(join(__dirname, '../components/table-engine/components/TableTd.tsx'), 'utf-8');

describe('TableEngine table column layout', () => {
  it('uses table-fixed to prevent content-driven column expansion', () => {
    expect(srcTableEngine).toContain('table-fixed');
  });

  it('column widths are driven by colWidths state', () => {
    expect(srcTableEngine).toContain('colWidths[col]');
  });

  it('resize handles rendered via handleResizeStart', () => {
    expect(srcTableEngine).toContain('handleResizeStart(e, col)');
  });

  it('column order is stored in colOrder state and persisted', () => {
    expect(srcColStateHook).toContain('colOrder');
    expect(srcColStateHook).toContain("localStorage.setItem");
    expect(srcColStateHook).toContain("localStorage.getItem");
  });

  it('column names are overrideable via colNames state', () => {
    expect(srcColStateHook).toContain('colNames');
    expect(srcTableEngine).toContain('colNames[col] || colState.DEFAULT_COL_NAMES[col]');
  });

  it('columns are rendered in order via orderedVisibleCols map', () => {
    expect(srcTableEngine).toContain('orderedVisibleCols.map');
    expect(srcTableEngine).toContain('orderedVisibleCols.map(col =>');
  });

  it('column drag-to-reorder handler exists', () => {
    expect(srcTableEngine).toContain('handleColPointerDown');
  });

  it('column rename handler exists', () => {
    expect(srcTableEngine).toContain('commitColRename');
    expect(srcTableEngine).toContain('renamingCol');
  });

  it('column headers expose a context menu for column actions', () => {
    expect(srcTableTh).toContain('onContextMenu');
    expect(srcTableEngine).toContain('headerContextMenu');
    expect(srcTableEngine).toContain('Nueva columna de texto');
    expect(srcTableEngine).toContain('Eliminar columna');
  });

  it('column value access supports dynamic getters', () => {
    expect(srcTableTd).toContain('getColumnValue');
    expect(srcTableEngine).toContain('getColumnValue');
  });

  it('resize handle is a visible element that changes color when active', () => {
    expect(srcTableTh).toContain('isResizing');
  });

  it('column header shows plain big text, rename mode shows rounded input', () => {
    expect(srcTableTh).toContain('text-gray-400');
    expect(srcTableTh).toContain('rounded-lg px-2 py-0.5 bg-white');
  });

  it('inline edit inputs use rounded rectangle style', () => {
    expect(srcTableTd).toContain('rounded-lg px-2 py-1 bg-white');
  });

  it('drop indicator uses an absolute vertical line', () => {
    expect(srcTableTh).toContain('w-0.5 bg-gray-900 rounded-full');
  });

  it('column drag shows a floating pill following the cursor', () => {
    expect(srcTableEngine).toContain('draggingColId &&');
    expect(srcTableEngine).toContain('colDragPos');
  });
});
