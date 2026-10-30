import { parseArDate } from '../../lib/ar-date.js';
import { normalizeInventoryImportStatus } from '../import/inventory-status.js';
import { canonicalInventoryValue, inventoryDuplicateKey } from './duplicate-key.js';
import { prepareInventoryImportRow, validateInventoryImportRow } from './import-validation.js';

type IncomingRow = {
  quantity?: number | string; imei?: string; serial?: string; model?: string; capacity?: string;
  color?: string; condition?: string; grade?: string; batteryHealth?: string;
  batteryNote?: string | null; entryDate?: string | null; cost?: number | string;
  price?: number | string | null; currency?: string; status?: string;
  supplierName?: string; purchasedAt?: string; purchaseName?: string;
  customFields?: Record<string, unknown>;
};

/** Pure grouping of this request only. Validation still runs on every original
 * invalid row; identifiers and repaired identifier rows never become candidates.
 */
export function inventoryImportGroups<T extends IncomingRow>(rows: T[], currency: string) {
  const groups: { row: T; quantity: number; indices: number[] }[] = [];
  const byKey = new Map<string, typeof groups[number]>();
  for (const [index, row] of rows.entries()) {
    const quantity = Number(String(row.quantity ?? '').trim() ? row.quantity : 1);
    const group = { row, quantity, indices: [index] };
    if (row.imei?.trim() || row.serial?.trim() || row.customFields?.serial || !Number.isSafeInteger(quantity) || quantity < 1
      || /IMEI duplicado|imei \(origen\)|Parece una fila de total/i.test(row.batteryNote ?? '')) {
      groups.push(group); continue;
    }
    const raw = Object.fromEntries(Object.entries(row).filter(([key, value]) => key !== 'customFields' && value != null)
      .map(([key, value]) => [key, String(value)]));
    const prepared = prepareInventoryImportRow(raw, index + 1, new Map());
    const validated = validateInventoryImportRow({ ...prepared, batteryNote: undefined, price: prepared.price?.trim() ? prepared.price : null }, index + 1, new Map());
    if (!validated.ok) { groups.push(group); continue; }
    const status = normalizeInventoryImportStatus(prepared.status);
    const fields = { ...row.customFields };
    if (prepared.originalStatus) fields.originalStatus = prepared.originalStatus;
    if (status.originalStatus) fields.originalStatus = status.originalStatus;
    const key = inventoryDuplicateKey({
      ...validated.value, capacity: prepared.capacity?.trim() || '',
      batteryNote: prepared.batteryNote || null,
      cost: String(Number(prepared.cost || 0)), price: prepared.price?.trim() ? String(Number(prepared.price)) : null,
      currency: prepared.currency || currency, status: status.status,
      entryDate: validated.value.entryDate?.toISOString().slice(0, 10) ?? null,
      customFields: fields,
      // These determine the purchase/supplier assigned after creation. Never
      // merge different incoming purchases before their database IDs exist.
      supplierId: prepared.supplierName?.trim() || null,
      stockPurchaseId: canonicalInventoryValue([prepared.purchaseName ?? null,
        prepared.purchasedAt ? parseArDate(prepared.purchasedAt)?.toISOString().slice(0, 10) : null]),
    });
    const previous = byKey.get(key);
    if (previous) { previous.quantity += quantity; previous.indices.push(index); }
    else { groups.push(group); byKey.set(key, group); }
  }
  return groups;
}

/** The spreadsheet/text wire format. Keep representative provenance and expose
 * line count for a quiet preview annotation; never treat it as inventory data.
 */
export function groupInventoryPreviewRows(rows: Record<string, string>[], currency: string) {
  const incoming = rows.map(row => ({ ...row, customFields: {
    ...(row.serial ? { serial: row.serial } : {}),
    ...(row._review ? { onboardingReview: row._review } : {}),
    ...(row._unassignedKey ? { _unassignedKey: row._unassignedKey } : {}),
    ...Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith('custom:')).map(([key, value]) => [key.slice(7), value])),
  } }));
  return inventoryImportGroups(incoming, currency).map(group => ({
    row: { ...rows[group.indices[0]!]!, ...(group.indices.length > 1 || rows[group.indices[0]!]!.quantity !== undefined ? { quantity: String(group.quantity) } : {}),
      ...(group.indices.length > 1 ? { _groupedLines: String(group.indices.reduce((sum, index) => sum + Number(rows[index]!._groupedLines || 1), 0)) } : {}),
    } as Record<string, string>,
    indices: group.indices,
  }));
}
