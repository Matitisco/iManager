/** Strict identity used by the admin report, repair script and incoming stock.
 * Do not trim/case-fold values here: near duplicates are deliberately distinct.
 */
export const INVENTORY_DUPLICATE_FIELDS = [
  'storeId', 'categoryId', 'model', 'capacity', 'color', 'condition', 'grade',
  'batteryHealth', 'batteryNote', 'cost', 'price', 'currency', 'status', 'supplierId',
  'stockPurchaseId', 'entryDate', 'customFields', 'catalogVisible', 'sampleBatchId',
] as const;

export function canonicalInventoryValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalInventoryValue).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalInventoryValue(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function inventoryDuplicateKey(row: Partial<Record<typeof INVENTORY_DUPLICATE_FIELDS[number], unknown>>): string {
  return canonicalInventoryValue(INVENTORY_DUPLICATE_FIELDS.map(field => row[field] ?? null));
}

/** Trusted, constant SQL only. Keep the legacy PostgreSQL hash and decimal/date
 * casts so existing admin groupKeys and exact/near-duplicate behavior stay stable.
 */
export function inventoryDuplicateKeySql(): string {
  const values = INVENTORY_DUPLICATE_FIELDS.map(field => {
    const column = `i."${field}"`;
    if (field === 'entryDate') return `${column}::date::text`;
    if (field === 'cost' || field === 'price') return `${column}::text`;
    if (field === 'customFields') return `coalesce(${column}, 'null'::jsonb)`;
    return column;
  });
  return `md5(jsonb_build_array(${values.join(', ')})::text)`;
}
