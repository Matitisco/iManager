/**
 * Tests that enforce the column layout contract of the Inventory table.
 *
 * Columns use `table-fixed` + pointer-event resize handles. Widths are applied
 * via inline `style={{ width }}` driven by `colWidths` state (localStorage-
 * persisted). These tests guard against accidental removal of those mechanisms.
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

  it('column widths are driven by colWidths state, not hard-coded Tailwind classes', () => {
    expect(src).toContain('colWidths.model');
    expect(src).toContain('colWidths.battery');
    expect(src).toContain('colWidths.price');
    expect(src).toContain('colWidths.status');
    expect(src).toContain('colWidths.imei');
  });

  it('default widths exist for all resizable columns', () => {
    expect(src).toContain('DEFAULT_COL_WIDTHS');
    // model default fits "iPhone 16 Pro Max 256GB" (~200px content at bold 14px)
    const match = src.match(/model:\s*(\d+)/);
    expect(match).not.toBeNull();
    const modelDefault = parseInt(match![1], 10);
    // 260px column - 48px padding (px-6 × 2) = 212px content area ≥ 200px needed
    expect(modelDefault - 48).toBeGreaterThanOrEqual(200);
  });

  it('minimum column widths are defined to prevent collapsing', () => {
    expect(src).toContain('MIN_COL_WIDTHS');
  });

  it('resize handles are rendered on all resizable columns', () => {
    expect(src).toContain("resizeHandle('model')");
    expect(src).toContain("resizeHandle('battery')");
    expect(src).toContain("resizeHandle('price')");
    expect(src).toContain("resizeHandle('status')");
    expect(src).toContain("resizeHandle('imei')");
  });

  it('handleResizeStart respects minimum column width', () => {
    expect(src).toContain('MIN_COL_WIDTHS[resizingRef.current.col]');
    expect(src).toContain('Math.max(minW');
  });

  it('colWidths is persisted to localStorage', () => {
    expect(src).toContain("localStorage.setItem('inventoryColWidths'");
    expect(src).toContain("localStorage.getItem('inventoryColWidths')");
  });

  it('Modelo td has truncate to ellipsize overflowing model names', () => {
    expect(src).toContain('transition-colors truncate');
  });
});
