import { parseArDate } from '../../lib/ar-date.js';
import { IMPORT_CATALOGS } from './import-catalog.js';
import { autoMap, isPurchaseHeader } from './column-mapping.js';
import { applyPlans, mappingColumnIndex, parseMoney, sheetHeaders, type ImportSheet, type SheetPlan } from './sheet-plan.js';
import type { PlanIssue } from './inventory-plan-validation.js';

/** Validate every physical cell, not just the sample used to infer the mapping. */
export function validateSalesPlan(sheets: ImportSheet[], plans: SheetPlan[], currency: 'ARS' | 'USD') {
  const issues: PlanIssue[] = [];
  const catalog = IMPORT_CATALOGS.sales;
  for (const sheet of sheets) {
    const plan = plans.find(item => item.name === sheet.name);
    if (!plan) { issues.push({ sheet: sheet.name, message: 'Falta plan para la hoja.' }); continue; }
    const headers = sheetHeaders(sheet.rows, plan.headerRow);
    const expected = autoMap(headers, catalog.fields, catalog.hints);
    const add = (message: string, column?: number) => issues.push({ sheet: sheet.name, column, message });
    if (!plan.include) {
      if (expected.amount && (expected.device || expected.clientName)) add('Hoja excluida con ventas detectadas.');
      continue;
    }
    if (!plan.mapping.some(column => column.field === 'amount')) add('Falta amount: revisá la columna de importe.');
    if (plan.dataStartRow !== plan.headerRow + 1 || plan.dataEndRow !== sheet.rows.length) add('El rango debe cubrir todas las filas bajo el encabezado.');
    const seen = new Set<string>();
    for (const column of plan.mapping) {
      const index = mappingColumnIndex(headers, column);
      if (!column.field || column.field === 'ignore') continue;
      if (index < 0 || !catalog.fields.some(field => field.key === column.field)) { add(`Campo o índice inválido: ${column.field}.`, index); continue; }
      if (seen.has(column.field) && column.field !== 'notes') add(`Campo duplicado: ${column.field}.`, index);
      seen.add(column.field);
      if (column.field === 'amount' && isPurchaseHeader(headers[index])) add('Costo/compra nunca es amount.', index);
      const values = sheet.rows.slice(plan.headerRow).map(row => row[index]?.trim() || '').filter(Boolean);
      const valid = column.field === 'amount' ? (value: string) => parseMoney(value) !== null
        : column.field === 'date' ? (value: string) => Boolean(parseArDate(value)) || /^\d{5}(?:\.\d+)?$/.test(value) : undefined;
      if (valid && values.length && values.filter(valid).length / values.length < 0.5) add(`Columna ${index}: la mayoría de valores no corresponde a ${column.field}; revisá el mapeo.`, index);
    }
    for (const field of ['date', 'amount', 'notes', 'productImei', 'paymentMethod']) {
      const header = expected[field];
      if (header && !plan.mapping.some(column => column.field === field)) add(`Falta mapear ${field} desde ${header}.`, headers.indexOf(header));
    }
  }
  return { issues, applied: applyPlans(sheets, plans, 'sales', currency) };
}
