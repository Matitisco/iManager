/**
 * Tests that enforce the column layout contract of the Inventory table.
 *
 * The table uses `table-fixed` + explicit column widths to prevent text-heavy
 * columns (Modelo, Batería) from dominating the layout and squishing
 * Precio/Disponibilidad. If these constraints are removed the table regresses
 * to unbalanced proportions.
 *
 * These tests read Inventory.tsx as a string and assert structural CSS classes
 * because the project uses node-only Vitest (no jsdom / React Testing Library).
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

  it('Modelo column header is capped at 260px', () => {
    // th must carry w-[260px] immediately before closing > and then "Modelo"
    expect(src).toMatch(/w-\[260px\][^>]*>Modelo</);
  });

  it('Batería column header is capped at 140px', () => {
    expect(src).toMatch(/w-\[140px\][^>]*>Bat/);
  });

  it('Precio column header is capped at 120px', () => {
    expect(src).toMatch(/w-\[120px\][^>]*>Precio</);
  });

  it('Disponibilidad column header is capped at 150px', () => {
    expect(src).toMatch(/w-\[150px\][^>]*>Disponibilidad</);
  });

  it('Modelo td has truncate so overflowing model names get an ellipsis', () => {
    // The Modelo <td> className template literal contains "transition-colors truncate"
    // (unique to that cell; Price td uses "text-right" instead of "truncate").
    expect(src).toContain('transition-colors truncate');
  });

  it('target string "iPhone 16 Pro Max 256GB" fits the 260px column (content area ≥ 200px)', () => {
    // 260px column - 48px horizontal padding (px-6 = 24px × 2) = 212px content area.
    // "iPhone 16 Pro Max 256GB" at bold 14px is ≈ 195-200px — fits without truncation.
    // This test validates the chosen width constant rather than rendering.
    const colMatch = src.match(/w-\[(\d+)px\][^>]*>Modelo</);
    expect(colMatch).not.toBeNull();
    const colWidth = parseInt(colMatch![1], 10);
    const contentArea = colWidth - 48; // subtract px-6 padding (24px × 2)
    expect(contentArea).toBeGreaterThanOrEqual(200);
  });
});
