/** Pure, conservative matching. Archived inventory remains a duplicate candidate. */
type Identity = { model: string; capacity?: string | null; color?: string | null; condition?: string | null; grade?: string | null; imei?: string | null };
type Existing = Identity & { id: string; createdAt: Date; archivedAt: Date | null };
type Incoming = Identity & { sourceRow?: number };
const normalized = (value?: string | null) => (value ?? '').toLowerCase().replace(/\s+/g, '');
const key = (row: Identity, quality: boolean) => JSON.stringify([
  row.model, row.capacity, row.color, ...(quality ? [row.condition || 'USADO', row.grade] : []),
].map(normalized));

export function detectInventoryImportDuplicates(rows: Incoming[], existing: Existing[]) {
  const byImei = new Map(existing.filter(item => item.imei?.trim()).map(item => [item.imei!.trim(), item]));
  const byIdentity = new Map<string, Existing[]>();
  const withoutImei = new Map<string, Existing[]>();
  for (const item of existing) {
    const fullKey = key(item, true);
    byIdentity.set(fullKey, [...(byIdentity.get(fullKey) ?? []), item]);
    if (!item.imei?.trim()) {
      const shortKey = key(item, false);
      withoutImei.set(shortKey, [...(withoutImei.get(shortKey) ?? []), item]);
    }
  }
  const willUpdate: { sourceRow: number; existingItemId: string }[] = [];
  const possibleDuplicates: {
    sourceRow: number; model: string; capacity: string; color: string; existingItemId: string;
    existingLabel: string; existingHasImei: boolean; createdAt: Date; archived: boolean;
    reason: 'same_identity' | 'existing_without_imei';
  }[] = [];
  for (const [index, row] of rows.entries()) {
    const sourceRow = row.sourceRow ?? index + 1;
    const match = row.imei?.trim() ? byImei.get(row.imei.trim()) : undefined;
    if (match) { willUpdate.push({ sourceRow, existingItemId: match.id }); continue; }
    const candidates = row.imei?.trim() ? withoutImei.get(key(row, false)) : byIdentity.get(key(row, true));
    for (const item of candidates ?? []) possibleDuplicates.push({
      sourceRow, model: row.model, capacity: row.capacity ?? '', color: row.color ?? '',
      existingItemId: item.id, existingLabel: [item.model, item.capacity, item.color].filter(Boolean).join(' '),
      existingHasImei: !!item.imei?.trim(), createdAt: item.createdAt, archived: item.archivedAt != null,
      reason: row.imei?.trim() ? 'existing_without_imei' : 'same_identity',
    });
  }
  return { willUpdate, possibleDuplicates };
}
