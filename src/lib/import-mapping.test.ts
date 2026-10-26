import { describe, expect, it } from 'vitest';
import { assignColumn, fieldToColumn, mappingFromFields, planColumns, updatePlanMapping } from './import-mapping';

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

it('preserves physical columns with empty or repeated headers through adjustment', () => {
  const columns = planColumns([['Modelo', '', 'Valor', 'Valor', ''], ['iPhone 13', '990000000000001', '300', '500', 'Black']], {
    headerRow: 1, mapping: [{ header: 'Modelo', columnIndex: 0, field: 'model' }],
  });
  const selected = fieldToColumn([{ header: 'Valor', columnIndex: 3, field: 'price' }]);
  const mapping = mappingFromFields(columns, assignColumn(selected, 'cost', 'column:2'));
  expect(mapping[2]).toEqual({ header: 'Valor', columnIndex: 2, field: 'cost' });
  expect(mapping[3]).toEqual({ header: 'Valor', columnIndex: 3, field: 'price' });
  expect(mapping).toHaveLength(5);
});

it('uses synthetic columns across every row and reincludes only when missing required fields are completed', () => {
  const plan = { include: false, headerRow: 0, mapping: [{ header: 'A', columnIndex: 0, field: '' }] };
  const columns = planColumns([['iPhone 13'], ['iPhone 14', '300']], plan);
  expect(columns.map(column => column.header)).toEqual(['A', 'B']);
  expect(updatePlanMapping(plan, [{ header: 'A', columnIndex: 0, field: 'model' }], ['model']).include).toBe(true);
  expect(updatePlanMapping(plan, columns, ['model']).include).toBe(false);
  const excludedManually = { ...plan, mapping: [{ header: 'A', columnIndex: 0, field: 'model' }] };
  expect(updatePlanMapping(excludedManually, excludedManually.mapping, ['model']).include).toBe(false);
});
