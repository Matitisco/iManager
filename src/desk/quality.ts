export const DEVICE_QUALITIES = [
  {
    value: 'A+',
    name: 'Como nuevo',
    description: 'Sin marcas visibles a simple vista; como mucho microrayones con luz directa.',
  },
  {
    value: 'A',
    name: 'Muy bueno',
    description: 'Marcas leves de uso visibles en pantalla o carcasa.',
  },
  {
    value: 'B',
    name: 'Bueno',
    description: 'Marcas moderadas, rayones o golpes leves visibles.',
  },
  {
    value: 'C',
    name: 'Con detalles',
    description: 'Desgaste evidente (rayones marcados, golpes en carcasa o marcas en pantalla), funcionando.',
  },
] as const;

export type DeviceQuality = (typeof DEVICE_QUALITIES)[number]['value'];

const EMPTY_QUALITY = new Set(['', 'n/a', 'na', '-', '—']);

export function isUsedCondition(condition: string | null | undefined): boolean {
  const key = (condition ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return key === 'usado' || key === 'used';
}

export function canonicalQuality(value: string | null | undefined): DeviceQuality | '' {
  const raw = (value ?? '').trim();
  if (!raw || EMPTY_QUALITY.has(raw.toLowerCase())) return '';
  return DEVICE_QUALITIES.find((item) => item.value.toLowerCase() === raw.toLowerCase())?.value ?? '';
}

/** Cosmetic grade shown for a used device. New devices, and anything outside the scale, stay blank. */
export function displayQuality(condition: string | null | undefined, grade: string | null | undefined): DeviceQuality | '' {
  if (!isUsedCondition(condition)) return '';
  return canonicalQuality(grade);
}

/** Grade of a device that enters through a trade-in: those devices are used. */
export function tradeQuality(grade: string | null | undefined): DeviceQuality | '' {
  return canonicalQuality(grade);
}

export function qualityPhrase(condition: string | null | undefined, grade: string | null | undefined): string {
  const value = displayQuality(condition, grade);
  return value ? `Calidad ${value}` : '';
}

export function qualityDetail(value: string): string {
  const item = DEVICE_QUALITIES.find((grade) => grade.value === value);
  return item ? `${item.value} · ${item.name}` : value;
}

export function qualityRank(value: string): number {
  const index = DEVICE_QUALITIES.findIndex((item) => item.value === value);
  return index === -1 ? DEVICE_QUALITIES.length : index;
}

/** Best-to-worst, or the reverse. Devices without a quality stay at the end either way. */
export function compareQuality(left: string, right: string, direction: 'best' | 'worst'): number {
  const leftRank = qualityRank(left);
  const rightRank = qualityRank(right);
  const leftEmpty = leftRank === DEVICE_QUALITIES.length;
  const rightEmpty = rightRank === DEVICE_QUALITIES.length;
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  return direction === 'best' ? leftRank - rightRank : rightRank - leftRank;
}
