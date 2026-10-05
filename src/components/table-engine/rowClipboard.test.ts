import { describe, expect, it } from 'vitest';
import {
  buildTsv,
  clearRowClipboardMemory,
  coerceNumber,
  duplicateUniqueValue,
  parseClipboardRows,
  rememberRowCopy,
  readMemoryCopy,
  toCreatePayloads,
} from './rowClipboard';

describe('row clipboard', () => {
  it('round-trips quoted cells and maps headers back to fields', () => {
    const tsv = buildTsv(
      ['Modelo', 'Nota'],
      [['iPhone 15', 'dice "ok"'], ['Pixel\t9', '']],
    );

    expect(parseClipboardRows(tsv, [
      { field: 'model', type: 'text', names: ['Modelo'] },
      { field: 'note', type: 'text', names: ['Nota'] },
    ])).toEqual([
      { values: { model: 'iPhone 15', note: 'dice "ok"' } },
      { values: { model: 'Pixel\t9', note: '' } },
    ]);
  });

  it('coerces numeric cells and keeps an internal copy for the same table', () => {
    clearRowClipboardMemory();
    rememberRowCopy({
      storageKey: 'inventory:user-1',
      tsv: 'Modelo\niPhone',
      rows: [{ values: { model: 'iPhone' }, categoryId: 'cat-1' }],
    });

    expect(readMemoryCopy('inventory:user-1')?.rows).toEqual([
      { values: { model: 'iPhone' }, categoryId: 'cat-1' },
    ]);
    expect(readMemoryCopy('sales:user-1')).toBeNull();
    expect(coerceNumber('$1,200')).toBe(1200);
    expect(coerceNumber('83,5')).toBe(83.5);
  });

  it('suffixes unique values only when duplicating a copied row', () => {
    const columns = [
      {
        field: 'imei',
        type: 'text' as const,
        names: ['IMEI'],
        onDuplicateValue: (value: unknown, index: number) => duplicateUniqueValue(value, index, 100),
      },
      { field: 'model', type: 'text' as const, names: ['Modelo'] },
    ];
    const drafts = [{ values: { imei: '123456789012345', model: 'iPhone 15' }, categoryId: 'phones' }];

    const [duplicated] = toCreatePayloads({
      columns,
      drafts,
      duplicate: true,
      fallbackCategoryId: null,
      buildNewItem: (formData, categoryId) => ({ ...formData, categoryId }),
    });
    const [external] = toCreatePayloads({
      columns,
      drafts,
      duplicate: false,
      fallbackCategoryId: null,
      buildNewItem: (formData, categoryId) => ({ ...formData, categoryId }),
    });

    expect(duplicated.model).toBe('iPhone 15');
    expect(duplicated.categoryId).toBe('phones');
    expect(duplicated.imei).not.toBe('123456789012345');
    expect(String(duplicated.imei).startsWith('123456789012345-')).toBe(true);
    expect(external.imei).toBe('123456789012345');
  });
});
