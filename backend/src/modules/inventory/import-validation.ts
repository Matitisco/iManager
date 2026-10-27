import { parseArDate } from '../../lib/ar-date.js';
import { validBatteryHealth } from '../../lib/battery-health.js';
import { parseOptionalImei } from '../../lib/imei.js';
import type { DiscardReason, ImportWarning } from '../import/import-diagnostics.js';
import { inventoryGrade } from './quality.js';

const CONDITIONS: Record<string, string> = {
  nuevo: 'NUEVO', new: 'NUEVO', usado: 'USADO', used: 'USADO', outlet: 'OUTLET',
  'pre-owned': 'PRE-OWNED', preowned: 'PRE-OWNED', 'pre owned': 'PRE-OWNED',
};

type Row = {
  model?: string; price?: number | null; condition?: string; imei?: string; grade?: string;
  color?: string; batteryHealth?: string; entryDate?: string | null; batteryNote?: string | null;
  purchasedAt?: string;
};

function normalizeBattery(value: string | undefined): string {
  if (value === undefined) return '100';
  const text = value.trim();
  const spacedRange = text.match(/^(\d+(?:[.,]\d+)?)\s*%\s+(\d+(?:[.,]\d+)?)\s*%?$/);
  if (spacedRange) return `${spacedRange[1]}-${spacedRange[2]}%`;
  const number = Number(text.replace(',', '.'));
  if (text && Number.isFinite(number) && number >= 0 && number <= 1) return String(Math.round(number * 100));
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
  if (raw.price != null && (!Number.isFinite(raw.price) || raw.price < 0)) return reject('invalid_price', 'Precio inválido');
  const conditionKey = raw.condition?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const condition = conditionKey ? CONDITIONS[conditionKey] : 'USADO';
  if (!condition) return reject('invalid_row', 'La condición no existe');
  const parsedImei = parseOptionalImei(raw.imei);
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
