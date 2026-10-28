import type { DefinitionInput } from '../custom-fields/custom-fields.service.js';
import { parseQuality } from '../inventory/quality.js';
import { validateInventoryImportRow, isInventoryFooter } from '../inventory/import-validation.js';
import { normalizeSectionRow } from './normalize-import.js';
import { validBatteryHealth } from '../../lib/battery-health.js';
import { isIgnoredInventoryHeader, isPurchaseHeader, autoMap } from './column-mapping.js';
import { IMPORT_CATALOGS } from './import-catalog.js';
import { applyPlans, MODEL_VALUE, contentMapping, mappingColumnIndex, normalizeBattery, parseMoney, rowLooksLikeData, sheetHeaders, type ImportSheet, type SheetPlan } from './sheet-plan.js';

/** Preserve cosmetic/original values instead of rejecting devices for a bad automatic type. */
export function repairInventoryQuality(sheets: ImportSheet[], plans: SheetPlan[]) {
  const definitions: DefinitionInput[] = [];
  const plan = plans.map(item => {
    const sheet = sheets.find(sheet => sheet.name === item.name);
    if (!sheet) return item;
    const headers = sheetHeaders(sheet.rows, item.headerRow);
    const mapping = item.mapping.map(column => {
      if (!['condition', 'grade'].includes(column.field)) return column;
      const index = mappingColumnIndex(headers, column);
      const values = sheet.rows.slice(item.dataStartRow - 1, item.dataEndRow)
        .filter(row => !isInventoryFooter({}, row)).map(row => row[index]?.trim() ?? '').filter(Boolean);
      const validCondition = (value: string) => validateInventoryImportRow({ model: 'Equipo', condition: value }, 1, new Map()).ok;
      if (!values.some(value => column.field === 'grade' ? !parseQuality(value).ok : !validCondition(value))) return column;
      if (column.field === 'condition' && values.every(value => parseQuality(value).ok)
        && !item.mapping.some(other => other.field === 'grade')) return { ...column, field: 'grade' };
      const key = column.field === 'grade' ? 'calidad_origen' : 'condicion_origen';
      if (!definitions.some(definition => definition.key === key)) definitions.push({
        entity: 'inventory', key, label: column.field === 'grade' ? 'Calidad (origen)' : 'Condición (origen)', type: 'text', order: 0,
      });
      return { ...column, field: `custom:${key}` };
    });
    return { ...item, mapping };
  });
  return { plan, definitions };
}

export type PlanIssue = { sheet: string; column?: number; message: string };
export function validateInventoryPlan(sheets: ImportSheet[], plans: SheetPlan[], currency: 'ARS' | 'USD') {
  const issues: PlanIssue[] = [];
  const add = (sheet: string, message: string, column?: number) => issues.push({ sheet, column, message });
  const known = new Set(IMPORT_CATALOGS.inventory.fields.map(field => field.key));
  for (const sheet of sheets) {
    const plan = plans.find(plan => plan.name === sheet.name);
    if (!plan) { add(sheet.name, 'Falta plan para la hoja.'); continue; }
    const headers = sheetHeaders(sheet.rows, plan.headerRow);
    const body = sheet.rows.slice(plan.headerRow).filter(row => row.some(Boolean) && !isInventoryFooter({}, row));
    const inferred = contentMapping(body);
    if (!plan.include) {
      if (inferred.some(column => column.field === 'model') || (body.length > 0 && autoMap(headers, IMPORT_CATALOGS.inventory.fields, IMPORT_CATALOGS.inventory.hints).model && !/gr[aá]fico|resumen/i.test(sheet.name))) add(sheet.name, 'Hoja excluida con equipos detectados por contenido.');
      continue;
    }
    if (!plan.mapping.some(column => column.field === 'model')) add(sheet.name, 'Falta model (obligatorio).');
    if (plan.headerRow > 0 && (rowLooksLikeData(sheet.rows[plan.headerRow - 1] ?? []) || sheet.rows.slice(0, plan.headerRow - 1).some(rowLooksLikeData))) add(sheet.name, `Fila ${plan.headerRow} elegida como encabezado contiene equipos; se perderían filas.`);
    if (plan.dataStartRow !== plan.headerRow + 1 || plan.dataEndRow !== sheet.rows.length) add(sheet.name, 'El rango debe cubrir todas las filas bajo el encabezado.');
    const seenFields = new Set<string>(), seenColumns = new Set<number>();
    for (const column of plan.mapping) {
      const index = mappingColumnIndex(headers, column);
      if (!column.field || column.field === 'ignore') continue;
      if (index < 0 || (!known.has(column.field) && !column.field.startsWith('custom:'))) { add(sheet.name, `Campo o índice inválido: ${column.field}.`, index); continue; }
      if ((seenFields.has(column.field) && column.field !== 'batteryNote') || seenColumns.has(index)) add(sheet.name, `Campo/columna duplicado: ${column.field}. Elegí una sola columna para este campo; las demás van como ignore. Para IMEI, elegí IMEI1/primero e ignorá IMEI2/secundario.`, index);
      seenFields.add(column.field); seenColumns.add(index);
      if (isIgnoredInventoryHeader(headers[index]) && !column.field.startsWith('custom:')) add(sheet.name, `Columna ${index} (${headers[index]}) no es un campo de negocio; usar ignore.`, index);
      if (column.field === 'price' && isPurchaseHeader(headers[index])) add(sheet.name, `Columna ${index}: costo/compra nunca es price.`, index);
      const values = body.map(row => row[index]?.trim() ?? '').filter(Boolean);
      const valid = (value: string) => {
        if (column.field.startsWith('custom:')) return true;
        if (column.field === 'price' || column.field === 'cost') { const n = parseMoney(value); return n != null && n >= 0; }
        if (column.field === 'model' && !/[\p{L}]/u.test(value) && !/^\d{1,2}$/.test(value)) return false;
        if (column.field === 'status') return /^(?:disponible|available|vendido|sold|en[ _]revision|review|reservado|reserved|sin servicio|servicio t[eé]cnico|servicio tec)$/i.test(value);
        if (column.field === 'capacity') return /^(?:\d+(?:[.,]\d+)?\s*(?:gb|tb|mb|g)|8|16|32|64|128|256|512|1024|2048)$/i.test(value);
        if (column.field === 'batteryHealth') return validBatteryHealth(normalizeBattery(value));
        if (column.field === 'currency') return /^(ARS|USD|u\$s|us\$|\$)$/i.test(value);
        // Use exactly the confirmation rules for fields that can reject a row.
        const record = normalizeSectionRow('inventory', { model: 'Equipo', [column.field]: value }, '', '', currency)!;
        return validateInventoryImportRow(record, 1, new Map()).ok;
      };
      if (column.field === 'model' && inferred.some(candidate => candidate.field === 'model' && candidate.columnIndex !== index)
        && values.length && values.filter(value => MODEL_VALUE.test(value) || /^\d{1,2}(?:\s+(?:pro|max|mini|plus|\d+\s*gb))*$/i.test(value)).length / values.length < .7) {
        add(sheet.name, `Columna ${index} (${headers[index]}) → model no concuerda con la columna de modelos detectada por contenido.`, index);
      }
      const invalid = values.filter(value => !valid(value)).length;
      if (invalid) add(sheet.name, `Columna ${index} (${headers[index]}) → ${column.field}: ${invalid}/${values.length} valores inválidos según la app.`, index);
    }
    for (const column of inferred) {
      if (!['model', 'imei', 'capacity', 'batteryHealth', 'status'].includes(column.field) || isIgnoredInventoryHeader(headers[column.columnIndex ?? -1] ?? '')) continue;
      const mapped = plan.mapping.find(mapped => mappingColumnIndex(headers, mapped) === column.columnIndex);
      if ((!mapped?.field || mapped.field !== column.field) && !plan.mapping.some(mapped => mapped.field === column.field)) {
        add(sheet.name, `Columna ${column.columnIndex} parece ${column.field} por contenido de todas las filas, pero falta ese campo.`, column.columnIndex);
      }
    }
    // Header hints can flag omissions, never overwrite a model's plan.
    const price = headers.findIndex(header => /^(p\.?\s*venta|u\$s\s*venta|venta|pvp|precio(?:\s+(?:usd|ars))?)$/i.test(header.trim()) && !isPurchaseHeader(header));
    if (price >= 0 && !plan.mapping.some(column => column.field === 'price')) add(sheet.name, `Columna ${price} (${headers[price]}) parece precio de venta, pero falta price.`, price);
  }
  const applied = applyPlans(sheets, plans, 'inventory', currency);
  for (const summary of applied.summary.sheets) {
    if (!plans.find(plan => plan.name === summary.name)?.include || !summary.diagnostics) continue;
    const d = summary.diagnostics;
    // Empty lines/footers/section titles are metadata, not rejected equipment.
    const total = d.detectedRows - (d.discardedByReason.empty ?? 0) - (d.discardedByReason.footer ?? 0) - (d.discardedByReason.section_header ?? 0);
    if (total > 0 && d.acceptedRows / total < .85) add(summary.name, `Aceptación ${d.acceptedRows}/${total} <85%. Motivos: ${JSON.stringify(d.discardedByReason)}.`);
  }
  return { issues, applied };
}

export function markPlanReview(plans: SheetPlan[], issues: PlanIssue[]): SheetPlan[] {
  return plans.map(plan => {
    const relevant = issues.filter(issue => issue.sheet === plan.name);
    const headers = plan.mapping;
    return { ...plan, mapping: headers.map(column => ({ ...column,
      ...(relevant.some(issue => issue.column === undefined || issue.column === column.columnIndex)
        ? { review: relevant.filter(issue => issue.column === undefined || issue.column === column.columnIndex).map(issue => issue.message) } : {}),
    })) };
  });
}

/** Enforce app invariants after retries without replacing valid model decisions. */
export function protectInventoryMappings(sheets: ImportSheet[], plans: SheetPlan[]): SheetPlan[] {
  return plans.map(plan => {
    const headers = sheetHeaders(sheets.find(sheet => sheet.name === plan.name)?.rows ?? [], plan.headerRow);
    const seen = new Set<string>();
    return { ...plan, mapping: plan.mapping.map(column => {
      if (!column.field || column.field.startsWith('custom:')) return column;
      const header = headers[mappingColumnIndex(headers, column)] ?? '';
      const prohibited = isIgnoredInventoryHeader(header) || (column.field === 'price' && isPurchaseHeader(header));
      const duplicate = seen.has(column.field) && column.field !== 'batteryNote';
      if (!prohibited && !duplicate) { seen.add(column.field); return column; }
      return { ...column, field: '', review: [...(column.review ?? []), prohibited
        ? 'Por revisar: la app impide asignar este encabezado a ese campo de negocio.'
        : 'Por revisar: el campo ya está asignado a otra columna.'] };
    }) };
  });
}

export function inventoryPlanScore(checked: ReturnType<typeof validateInventoryPlan>): number {
  const penalty = checked.issues.reduce((sum, issue) => {
    if (/Falta model|excluida|encabezado contiene|Falta plan/.test(issue.message)) return sum + 100;
    if (/<85%/.test(issue.message)) return sum + 20;
    const ratio = /(\d+)\/(\d+) valores inválidos/.exec(issue.message);
    return sum + 1 + (ratio ? 10 * Number(ratio[1]) / Number(ratio[2]) : 0);
  }, 0);
  return penalty * 1_000_000 - checked.applied.diagnostics.acceptedRows;
}
