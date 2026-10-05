export function parseCellTags(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : value == null || value === ''
        ? []
        : [value];

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const label = String(item ?? '').trim();
    const key = label.toLocaleLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    tags.push(label);
  }
  return tags;
}

export function sameCellTags(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

export function normalizeStoredCustomValue(type: string | undefined, value: unknown) {
  if (type === 'number') {
    return value === '' || value == null ? '' : Number(value);
  }
  if (type === 'tags') return parseCellTags(value);
  return value;
}

export function customFieldsFromRowForm(
  formData: Record<string, unknown>,
  columns: readonly { id: string; type: string }[],
) {
  const entries = Object.entries(formData)
    .filter(([key, value]) => key.startsWith('dynamic:') && value !== '' && value != null)
    .map(([key, value]) => {
      const columnId = key.replace('dynamic:', '');
      const type = columns.find((column) => column.id === columnId)?.type;
      return [columnId, normalizeStoredCustomValue(type, value)] as const;
    })
    .filter(([, value]) => !(Array.isArray(value) && value.length === 0));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function withCustomField<T extends { customFields?: Record<string, unknown> }>(
  row: T,
  columns: readonly { id: string; type: string }[],
  columnId: string,
  value: unknown,
): T {
  const type = columns.find((column) => column.id === columnId)?.type;
  return {
    ...row,
    customFields: {
      ...(row.customFields ?? {}),
      [columnId]: normalizeStoredCustomValue(type, value),
    },
  };
}
