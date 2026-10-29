import type { CustomFieldInput } from '../services/custom-fields-api';
import type { ImportSheetPayload, ImportSheetPlan } from '../services/import-api';
import { columnLetter, importColumns } from './import-preview';

export type DiscardedImportColumns = Record<string, number[]>;
export const importColumnScope = (sheet: ImportSheetPlan) => `${sheet.name}:${sheet.headerRow}`;

export function automaticFieldName(sheet: ImportSheetPlan, grid: string[][], index: number) {
  return (sheet.headerRow > 0 ? grid[sheet.headerRow - 1]?.[index]?.trim() : '') || `Columna ${columnLetter(index)}`;
}

export function unassignedImportColumns(sheet: ImportSheetPlan, grid: string[][], discarded: DiscardedImportColumns) {
  return importColumns(sheet, grid).filter(column => column.field === 'ignore'
    && !discarded[importColumnScope(sheet)]?.includes(column.columnIndex));
}

/** Add values to the existing equipment rows; saving still uses one atomic request. */
export function prepareAutomaticImportFields(
  rows: Record<string, string>[], sheets: ImportSheetPayload[], plan: ImportSheetPlan[],
  definitions: CustomFieldInput[], discarded: DiscardedImportColumns,
) {
  const catalog = [...definitions];
  const additions: CustomFieldInput[] = [];
  const included = plan.filter(sheet => sheet.include);
  const bySheet = new Map(included.map(sheet => {
    const grid = sheets.find(source => source.name === sheet.name)?.rows ?? [];
    const used = new Set(sheet.mapping.map(column => column.field));
    const columns = unassignedImportColumns(sheet, grid, discarded).map(column => {
      // Labels share the definition service's maximum; keys remain independent of labels.
      const label = automaticFieldName(sheet, grid, column.columnIndex).slice(0, 100);
      let definition = catalog.find(field => field.type === 'text' && field.label === label && !used.has(`custom:${field.key}`));
      if (!definition) {
        const base = `cf_${label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 45) || 'columna'}`;
        let key = base;
        for (let suffix = 2; catalog.some(field => field.key === key); suffix++) key = `${base}_${suffix}`;
        definition = { entity: 'inventory', key, label, type: 'text', order: catalog.length };
        catalog.push(definition);
        additions.push(definition);
      }
      const key = `custom:${definition.key}`;
      used.add(key);
      return { index: column.columnIndex, key };
    });
    return [sheet.name, { sheet, grid, columns }] as const;
  }));
  const importingRows = rows.map((row, index) => {
    const source = bySheet.get(row._sourceSheet || (included.length === 1 ? included[0].name : ''));
    if (!source?.columns.length) return row;
    const sourceIndex = Number(row._sourceRow) - 1;
    const original = source.grid[Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : source.sheet.dataStartRow - 1 + index];
    if (!original) return row;
    return { ...row, ...Object.fromEntries(source.columns.map(column => [column.key, original[column.index] ?? ''])) };
  });
  return { rows: importingRows, definitions: [...definitions, ...additions].filter(field => importingRows.some(row => Object.hasOwn(row, `custom:${field.key}`))) };
}
