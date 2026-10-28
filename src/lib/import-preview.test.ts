import { expect, it } from 'vitest';
import { assignImportColumn, columnHasData, columnLetter, importColumns, reorderPreviewColumns, resizePreviewColumn } from './import-preview';
import type { ImportSheetPlan } from '../services/import-api';
const plan: ImportSheetPlan = { name: 'Stock', include: true, condition: '', headerRow: 1, dataStartRow: 2, dataEndRow: 3, splitModelCapacity: false, batteryAsPercent: false, priceCurrency: 'USD', mapping: [{ header: 'Modelo', columnIndex: 0, field: 'model' }, { header: 'Precio', columnIndex: 1, field: 'price' }] };
it('mantiene Modelo fijo, limita el destino y no muta el orden original', () => {
  const order = ['model', 'capacity', 'color', 'price'];
  expect(reorderPreviewColumns(order, 'price', 0)).toEqual(['model', 'price', 'capacity', 'color']);
  expect(reorderPreviewColumns(order, 'capacity', 99)).toEqual(['model', 'color', 'price', 'capacity']);
  expect(reorderPreviewColumns(order, 'model', 3)).toBe(order);
  expect(reorderPreviewColumns(order, 'missing', 1)).toBe(order);
  expect(order).toEqual(['model', 'capacity', 'color', 'price']);
});
it('limita y redondea el ancho para mouse, touch y teclado', () => {
  expect(resizePreviewColumn(140, 24.8)).toBe(165);
  expect(resizePreviewColumn(140, -999)).toBe(100);
  expect(resizePreviewColumn(140, 999)).toBe(480);
  expect(resizePreviewColumn(140, NaN)).toBe(140);
});
it('identifica columnas vacías, duplicadas y sin encabezado por índice físico', () => {
  const rows = [['Modelo', 'Precio', 'Precio'], ['iPhone', '100', '0'], ['Otro', '200', ' ']];
  expect(columnLetter(26)).toBe('AA');
  expect(importColumns(plan, rows).map(column => column.field)).toEqual(['model', 'price', 'ignore']);
  expect(columnHasData(plan, rows, 2)).toBe(true);
  expect(columnHasData(plan, [['Nombre', 'Vacía'], ['iPhone', ' ']], 1)).toBe(false);
  const next = assignImportColumn(plan, rows, 2, 'price');
  expect(next.mapping.map(column => column.field)).toEqual(['model', 'ignore', 'price']);
  expect(plan.mapping[1].field).toBe('price');
  expect(importColumns({ ...plan, headerRow: 0 }, rows)[0].header).toBe('A');
});
