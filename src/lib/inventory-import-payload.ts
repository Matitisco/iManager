import type { InventoryImportRow } from '../services/import-api';
import { parseImportNumber } from './import-number';

export function inventoryImportPayload(rows: Record<string, string>[]): InventoryImportRow[] {
  return rows.map((row) => ({
    sourceRow: row._sourceRow ? Number(row._sourceRow) : undefined,
    entryDate: row.entryDate,
    batteryNote: row.batteryNote,
    supplierName: row.supplierName,
    imei: row.imei ?? '',
    model: row.model ?? '',
    price: row.price?.trim() ? parseImportNumber(row.price) ?? Number.NaN : null,
    capacity: row.capacity,
    color: row.color,
    condition: row.condition,
    grade: row.grade,
    batteryHealth: row.quantity ? row.batteryHealth || 'N/A' : row.batteryHealth,
    cost: parseImportNumber(row.cost),
    currency: row.currency === 'ARS' || row.currency === 'USD' ? row.currency : undefined,
    customFields: {
      ...(row.serial ? { serial: row.serial } : {}),
      ...(row.originalStatus ? { originalStatus: row.originalStatus } : {}),
      ...Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith('custom:')).map(([key, value]) => [key.slice(7), value])),
    },
    status: row.status,
    purchasedAt: row.purchasedAt,
    purchaseName: row.purchaseName,
  }));
}
