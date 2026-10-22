import { describe, expect, it } from 'vitest';
import { uniqueCapacityChoices } from './equipment-capacity-options';

const choices = (...values: string[]) => values.map(id => ({ id, label: id }));

describe('uniqueCapacityChoices', () => {
  it('collapses exact duplicates, whitespace and unit casing while keeping source order', () => {
    expect(uniqueCapacityChoices(choices('128 GB', '64GB', '128GB', '128gb', '128\u00a0GB', '64GB', '256GB'), ''))
      .toEqual(choices('128 GB', '64GB', '256GB'));
  });

  it('preserves the first label and original selected value without mutating its sources', () => {
    const source = [{ id: '128GB', label: '128 GB', color: '#737984' }, ...choices('128 gb', '64GB')];
    const original = structuredClone(source);
    expect(uniqueCapacityChoices(source, '128 gb')).toEqual([
      { id: '128 gb', label: '128 GB', color: '#737984' }, ...choices('64GB'),
    ]);
    expect(source).toEqual(original);
  });

  it('keeps extra capacities and distinct units/custom names', () => {
    expect(uniqueCapacityChoices(choices('1 TB', '1tb', '1024GB', '2TB', 'Sin capacidad', 'Sincapacidad', '128'), ''))
      .toEqual(choices('1 TB', '1024GB', '2TB', 'Sin capacidad', 'Sincapacidad', '128'));
  });

  it('uses catalog values again after clearing a legacy selection', () => {
    expect(uniqueCapacityChoices(choices('128GB', '128 GB'), '')).toEqual(choices('128GB'));
  });

  it('does not invent an option for a missing selection or an empty source', () => {
    expect(uniqueCapacityChoices([], '128GB')).toEqual([]);
    expect(uniqueCapacityChoices(choices('64GB'), '128GB')).toEqual(choices('64GB'));
  });
});
