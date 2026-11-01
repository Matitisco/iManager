import { describe, expect, it } from 'vitest';
import { detectInventoryImportDuplicates as detect } from './inventory-import-duplicates.js';
const identity = { model: 'iPhone 13', capacity: '128 GB', color: 'Black', condition: 'USADO', grade: 'A' };
const existing = { ...identity, id: 'existing', imei: null, archivedAt: null, createdAt: new Date('2026-01-01') };
describe('inventory import possible duplicates', () => {
  it('matches case/whitespace insensitive identity, including archived inventory', () => {
    const result = detect([{ ...identity, model: ' IPHONE  13 ', capacity: '128gb', sourceRow: 8 }], [{ ...existing, imei: '990000000000018', archivedAt: new Date() }]);
    expect(result.willUpdate).toEqual([]);
    expect(result.possibleDuplicates).toMatchObject([{ sourceRow: 8, existingHasImei: true, archived: true, reason: 'same_identity' }]);
  });
  it('requires matching condition/grade for incoming rows without IMEI', () => {
    expect(detect([{ ...identity, grade: 'B' }], [existing]).possibleDuplicates).toEqual([]);
    expect(detect([{ ...identity, condition: 'NUEVO' }], [existing]).possibleDuplicates).toEqual([]);
  });
  it('prioritizes exact IMEI updates over potential duplicates', () => {
    expect(detect([{ ...identity, imei: '990000000000018', sourceRow: 4 }], [existing, { ...existing, id: 'with-imei', imei: '990000000000018' }])).toEqual({ willUpdate: [{ sourceRow: 4, existingItemId: 'with-imei' }], possibleDuplicates: [] });
  });
  it('flags new IMEI against identifier-free manual stock regardless of grade', () => {
    expect(detect([{ ...identity, grade: 'B', imei: '990000000000018' }], [existing]).possibleDuplicates).toMatchObject([{ reason: 'existing_without_imei', existingHasImei: false }]);
    expect(detect([{ ...identity, imei: '990000000000018' }], [{ ...existing, imei: '990000000000026' }]).possibleDuplicates).toEqual([]);
  });
  it('requires model/capacity/color and reports multiple matching items', () => {
    expect(detect([{ ...identity, color: 'Blue' }], [existing]).possibleDuplicates).toEqual([]);
    expect(detect([{ ...identity, capacity: '256GB' }], [existing]).possibleDuplicates).toEqual([]);
    expect(detect([identity], [existing, { ...existing, id: 'another' }]).possibleDuplicates).toHaveLength(2);
  });
});
