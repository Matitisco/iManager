export function normalizeDropdownOptions(values: readonly unknown[]) {
  const options: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const label = String(value ?? '').trim();
    const key = label.toLocaleLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    options.push(label);
  }

  return options;
}
