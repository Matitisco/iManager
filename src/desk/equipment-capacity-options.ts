type CapacityChoice = { id: string; label: string; color?: string };

function capacityKey(value: string) {
  const compact = value.replace(/\s/g, '');
  return /^\d+(?:[.,]\d+)?(?:GB|TB)$/i.test(compact) ? compact.toUpperCase() : value;
}

// Catalog choices come first. Keep their labels/order, but retain a selected
// legacy value so saving an unrelated edit never rewrites its stored capacity.
export function uniqueCapacityChoices(choices: CapacityChoice[], selected: string): CapacityChoice[] {
  const seen = new Set<string>();
  const selectedKey = capacityKey(selected);
  return choices.flatMap(choice => {
    const key = capacityKey(choice.id);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...choice, id: selected && key === selectedKey ? selected : choice.id }];
  });
}
