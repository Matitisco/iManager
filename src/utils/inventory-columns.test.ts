/**
 * Tests that enforce the column layout contract of the Inventory table.
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
const src = readFileSync(join(__dirname, '../pages/Inventory.tsx'), 'utf-8');

describe('Inventory table column layout', () => {
  it('uses table-fixed to prevent content-driven column expansion', () => {
    expect(src).toContain('table-fixed');
  });

  it('column widths are driven by colWidths state', () => {
    expect(src).toContain('colWidths[col]');
  });

  it('default widths exist and model default fits target string', () => {
    expect(src).toContain('DEFAULT_COL_WIDTHS');
    const match = src.match(/model:\s*(\d+)/);
    expect(match).not.toBeNull();
    // 260px - 24px (px-3 × 2) = 236px content area ≥ 200px needed for "iPhone 16 Pro Max 256GB"
    expect(parseInt(match![1], 10) - 24).toBeGreaterThanOrEqual(200);
  });

  it('single uniform minimum column width constant', () => {
    expect(src).toContain('MIN_COL_WIDTH');
    expect(src).toContain('Math.max(MIN_COL_WIDTH');
  });

  it('resize handles rendered via data-driven resizeHandle(col)', () => {
    expect(src).toContain('resizeHandle(col)');
  });

  it('column order is stored in colOrder state and persisted', () => {
    expect(src).toContain('colOrder');
    expect(src).toContain("localStorage.setItem('inventoryColOrder'");
    expect(src).toContain("localStorage.getItem('inventoryColOrder')");
  });

  it('column names are overrideable via colNames state', () => {
    expect(src).toContain('colNames');
    expect(src).toContain('DEFAULT_COL_NAMES');
    expect(src).toContain("localStorage.setItem('inventoryColNames'");
  });

  it('columns are rendered in order via orderedVisibleCols map', () => {
    expect(src).toContain('orderedVisibleCols');
    expect(src).toContain('orderedVisibleCols.map(col => renderTh(col))');
    expect(src).toContain('orderedVisibleCols.map(col => renderTd(col, invItem))');
  });

  it('column drag-to-reorder handler exists', () => {
    expect(src).toContain('handleColPointerDown');
    expect(src).toContain('setColOrder');
  });

  it('column rename handler exists', () => {
    expect(src).toContain('commitColRename');
    expect(src).toContain('renamingCol');
  });

  it('active resize column gets dark cell visual', () => {
    expect(src).toContain("activeResizeCol === col ? 'bg-gray-900 text-white'");
  });

  it('drop indicator uses box-shadow to avoid layout shift', () => {
    expect(src).toContain('shadow-[inset_2px_0_0_0_#3b82f6]');
  });

  it('all cells use consistent px-3 padding', () => {
    // No px-6 padding should remain in table th/td elements
    expect(src).not.toContain("px-6 py-4'>Modelo");
    expect(src).not.toContain("px-6 py-4'>Batería");
  });
});
