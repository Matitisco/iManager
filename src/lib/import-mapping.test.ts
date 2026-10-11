import { describe, expect, it } from 'vitest';
import {
  applyColumnSuggestions,
  assignColumn,
  autoMap,
  columnSamples,
} from './import-mapping';

const fields = [
  { key: 'model', label: 'Modelo' },
  { key: 'color', label: 'Color' },
  { key: 'price', label: 'Precio' },
];

describe('import mapping helpers', () => {
  it('maps by hint and does not reuse a column', () => {
    expect(autoMap(
      ['Modelo y color', 'Precio'],
      fields,
      { precio: 'price' },
    )).toEqual({ model: 'Modelo y color', price: 'Precio' });
  });

  it('sends at most eight short samples', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ Equipo: index === 0 ? '' : `fila ${index} ${'x'.repeat(100)}` }));
    const samples = columnSamples(rows, 'Equipo');
    expect(samples).toHaveLength(8);
    expect(samples[0]?.length).toBeLessThanOrEqual(80);
  });

  it('applies suggestions, keeps low confidence and notes the duplicate', () => {
    const applied = applyColumnSuggestions(fields, [
      { header: 'Equipo', field: 'model', confidence: 0.94, review: false, suggestedField: 'model' },
      { header: 'Pintura', field: 'color', confidence: 0.46, review: true, suggestedField: 'color' },
      { header: 'Valor', field: null, confidence: 0.62, review: true, suggestedField: 'price' },
      { header: 'Obs', field: null, confidence: 0.2, review: true, suggestedField: null },
    ]);

    expect(applied.fieldToColumn).toEqual({ model: 'Equipo', color: 'Pintura' });
    expect(applied.reviewByField.color).toBe(true);
    expect(applied.confidenceByField.model).toBe(0.94);
    expect(applied.notes).toEqual([
      { header: 'Valor', suggestedField: 'price', confidence: 0.62 },
      { header: 'Obs', suggestedField: null, confidence: 0.2 },
    ]);
  });

  it('clears the previous field when a column is chosen twice', () => {
    expect(assignColumn({ model: 'Equipo', color: 'Pintura' }, 'color', 'Equipo')).toEqual({
      model: '',
      color: 'Equipo',
    });
  });
});
