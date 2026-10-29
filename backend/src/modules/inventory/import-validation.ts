import { parseArDate } from '../../lib/ar-date.js';
import { validBatteryHealth } from '../../lib/battery-health.js';
import { parseOptionalImei } from '../../lib/imei.js';
import type { DiscardReason, ImportWarning } from '../import/import-diagnostics.js';
import { normalizeInventoryImportStatus } from '../import/inventory-status.js';
import { inventoryGrade } from './quality.js';

const CONDITIONS: Record<string, string> = {
  nuevo: 'NUEVO', new: 'NUEVO', usado: 'USADO', used: 'USADO', outlet: 'OUTLET',
  'pre-owned': 'PRE-OWNED', preowned: 'PRE-OWNED', 'pre owned': 'PRE-OWNED',
};

type Row = {
  model?: string; price?: number | string | null; condition?: string; imei?: string; grade?: string;
  color?: string; batteryHealth?: string; entryDate?: string | null; batteryNote?: string | null;
  purchasedAt?: string;
  capacity?: string;
  cost?: number | string;
};

export const ILLEGIBLE_IMEI_MESSAGE = 'IMEI ilegible: el Excel guardó el número en notación científica y se perdieron dígitos; formateá la columna como texto';

function parseImportImei(value: string | undefined) {
  let text = value?.trim() ?? '';
  if (/e[+-]?\d+$/i.test(text)) {
    const scientific = /^(\d)[.,](\d{14,})e\+?14$/i.exec(text);
    // All fifteen digits must actually be present. Never pad a short mantissa.
    if (!scientific || /[1-9]/.test(scientific[2].slice(14))) {
      return { ok: false as const, message: ILLEGIBLE_IMEI_MESSAGE };
    }
    text = scientific[1] + scientific[2].slice(0, 14);
    // Explicit scientific tails of zeroes carry insufficient useful precision.
    if (/0{5,}$/.test(text)) return { ok: false as const, message: ILLEGIBLE_IMEI_MESSAGE };
  }
  return parseOptionalImei(text.replace(/^(\d{15})\.0+$/, '$1'));
}

export function isInventoryFooter(raw: Row, cells?: string[]): boolean {
  const imei = parseImportImei(raw.imei);
  const capacity = /^(?:\d+(?:[.,]\d+)?\s*(?:gb|tb|mb)|8|16|32|64|128|256|512|1024|2048)$/i.test(raw.capacity?.trim() ?? '');
  if ((imei.ok && imei.imei) || capacity) return false;
  const values = cells ?? [raw.model, raw.capacity, raw.imei, raw.color, raw.condition, raw.grade, raw.batteryHealth,
    raw.entryDate, raw.batteryNote, raw.purchasedAt, raw.price, raw.cost].map(value => value == null ? '' : String(value));
  const firstText = values.find(cell => /[a-záéíóúñ]/i.test(cell));
  const footer = /^(?:(?:total|subtotal|suma|totales|nota|notas|observaci[oó]n(?:es)?)\b|stock\s+total\b)/i;
  if ([raw.model, firstText].some(text => text && footer.test(text.trim()))) return true;
  const filled = values.map(cell => cell.trim()).filter(Boolean);
  const compact = filled.join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\s]/g, '');
  if (filled.length <= 2 && /precionoincluye|noincluyeiva|cotizacion|^precios?.*(efectivo|transferencia|promocion)/.test(compact)) return true;
  // Amount-only lines have neither a model nor an identifier. A bad non-empty
  // IMEI still needs invalid_imei rather than being hidden as a footer.
  return !/[a-záéíóúñ]/i.test(raw.model ?? '') && !raw.imei?.trim() && values.some(cell => /\d/.test(cell))
    && values.every(cell => !cell.trim() || /^[\d\s.,$+()-]+$/.test(cell.trim()));
}

function normalizeBattery(value: string | undefined): string {
  if (value === undefined) return '100';
  const text = value.trim();
  const spacedRange = text.match(/^(\d+(?:[.,]\d+)?)\s*%\s+(\d+(?:[.,]\d+)?)\s*%?$/);
  if (spacedRange) return `${spacedRange[1]}-${spacedRange[2]}%`;
  const number = Number(text.replace(',', '.'));
  if (text && Number.isFinite(number) && number >= 0 && number <= 1) return `${Math.round(number * 100)}%`;
  return text;
}

/** Pure file validation shared by preview and confirmation. No store/DB lookups. */
export function validateInventoryImportRow(raw: Row, row: number, seenImeis: ReadonlyMap<string, number>) {
  let batteryHealth = normalizeBattery(raw.batteryHealth);
  const warnings: ImportWarning[] = [];
  if (!validBatteryHealth(batteryHealth)) {
    batteryHealth = '';
    // Never echo arbitrary spreadsheet cells into diagnostics/logs.
    warnings.push({ row, message: 'Batería no se pudo leer: se importó sin batería' });
  }
  const reject = (reason: DiscardReason, message: string) => ({ ok: false as const, reason, message, warnings });
  if (!raw.model?.trim()) return reject('missing_model', 'Modelo vacío');
  if (/^=|^#(?:REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!)/i.test(raw.model.trim())) {
    return reject('missing_model', 'El modelo contiene una fórmula o un error de Excel. Escribí el nombre del equipo.');
  }
  if (raw.cost != null && String(raw.cost).trim() && (!Number.isFinite(Number(raw.cost)) || Number(raw.cost) < 0)) {
    return reject('invalid_price', 'Costo inválido. Corregilo o dejá la celda vacía antes de importar.');
  }
  if (raw.price != null && (!String(raw.price).trim() || !Number.isFinite(Number(raw.price)) || Number(raw.price) < 0)) return reject('invalid_price', 'Precio inválido. Corregilo o dejá la celda vacía para definirlo después.');
  const conditionKey = raw.condition?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const condition = conditionKey ? CONDITIONS[conditionKey] : 'USADO';
  if (!condition) return reject('invalid_row', 'La condición no existe');
  const parsedImei = parseImportImei(raw.imei);
  if (!parsedImei.ok) return reject('invalid_imei', parsedImei.message);
  const firstRow = parsedImei.imei ? seenImeis.get(parsedImei.imei) : undefined;
  if (firstRow !== undefined) return reject('duplicate', `IMEI repetido en el archivo (igual a la fila ${firstRow})`);
  const parsedGrade = inventoryGrade(condition, raw.grade);
  if (!parsedGrade.ok) return reject('invalid_row', parsedGrade.message);
  const color = raw.color?.trim() || '';
  if (color.length > 50) return reject('invalid_row', 'El color puede tener hasta 50 caracteres');
  const entryDate = raw.entryDate ? parseArDate(raw.entryDate) : null;
  if (raw.entryDate && !entryDate) return reject('invalid_row', 'Fecha de ingreso inválida (dd/mm/aaaa)');
  if ((raw.batteryNote?.length ?? 0) > 2000) return reject('invalid_row', 'Detalle batería: máximo 2000 caracteres');
  if (raw.purchasedAt?.trim() && !parseArDate(raw.purchasedAt)) return reject('invalid_row', 'Fecha de compra inválida');
  return { ok: true as const, warnings, value: {
    model: raw.model.trim(), imei: parsedImei.imei, condition, grade: parsedGrade.grade, color, entryDate, batteryHealth,
  } };
}

/** Lossless file preparation. One nonempty source row always remains one device. */
export function prepareInventoryImportRow(raw: Record<string, string>, row: number, seenImeis: Map<string, number>) {
  const next = { ...raw };
  const notes: string[] = [];
  let needsReview = false;
  const preserve = (field: string, fallback = '') => {
    needsReview = true;
    if (next[field]?.trim()) notes.push(`${field} (origen): ${next[field]}`);
    next[field] = fallback;
  };
  if (!next.model?.trim() || next.model.length > 100 || /^=|^#(?:REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!)/i.test(next.model.trim())) preserve('model', 'Equipo sin modelo');
  for (const field of ['price', 'cost']) {
    const value = next[field];
    if (value?.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 9999999999.99)) preserve(field);
  }
  const condition = next.condition?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (condition && !CONDITIONS[condition]) preserve('condition', 'USADO');
  const grade = inventoryGrade(next.condition || 'USADO', next.grade);
  if (!grade.ok || (next.grade?.trim() && !grade.grade)) preserve('grade');
  const parsed = parseImportImei(next.imei);
  if (!parsed.ok) preserve('imei');
  else {
    next.imei = parsed.imei ?? '';
    if (parsed.imei && seenImeis.has(parsed.imei)) {
      notes.push(`IMEI duplicado en el archivo: ${parsed.imei}`);
      next.imei = '';
    } else if (parsed.imei) seenImeis.set(parsed.imei, row);
  }
  for (const field of ['capacity', 'color']) if ((next[field]?.length ?? 0) > 50) preserve(field);
  if (next.capacity?.trim() && !/^(?:\d+(?:[.,]\d+)?\s*(?:gb|tb|mb|g)|8|16|32|64|128|256|512|1024|2048)$/i.test(next.capacity)) preserve('capacity');
  const battery = normalizeBattery(next.batteryHealth);
  if (!validBatteryHealth(battery)) preserve('batteryHealth');
  else if (next.batteryHealth !== undefined) next.batteryHealth = battery;
  for (const field of ['entryDate', 'purchasedAt']) {
    if (next[field] !== undefined) next[field] = next[field].trim();
    if (next[field] && !parseArDate(next[field])) preserve(field);
  }
  if (next.currency?.trim() && !['ARS', 'USD'].includes(next.currency)) preserve('currency');
  if ((next.supplierName?.length ?? 0) > 120) preserve('supplierName');
  if ((next.purchaseName?.length ?? 0) > 120) preserve('purchaseName');
  if (next.status?.trim()) Object.assign(next, normalizeInventoryImportStatus(next.status));
  if (notes.length) next.batteryNote = [next.batteryNote, ...notes].filter(Boolean).join('\n');
  if (notes.length || needsReview) next.status = 'EN_REVISION';
  return next;
}
