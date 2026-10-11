import { describe, expect, it } from 'vitest';
import { assignColumn, fieldToColumn, mappingFromFields } from './import-mapping';

describe('import mapping helpers', () => {
  it('reads a plan mapping without repeating a field', () => {
    expect(fieldToColumn([
      { header: 'Equipo', field: 'model' },
      { header: 'Valor', field: 'price' },
      { header: 'Obs', field: '' },
    ])).toEqual({ model: 'Equipo', price: 'Valor' });
  });

  it('clears the previous field when a column is chosen twice', () => {
    expect(assignColumn({ model: 'Equipo', color: 'Pintura' }, 'color', 'Equipo')).toEqual({
      model: '',
      color: 'Equipo',
    });
  });

  it('writes the edited columns back as a mapping', () => {
    expect(mappingFromFields(
      ['Equipo', 'Valor', 'Obs'],
      { model: 'Equipo', price: 'Valor', color: '' },
    )).toEqual([
      { header: 'Equipo', field: 'model' },
      { header: 'Valor', field: 'price' },
      { header: 'Obs', field: '' },
    ]);
  });
});
