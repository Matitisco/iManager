import type { BadgeMeta } from './types';

export interface TagColor {
  id: string;
  name: string;
  bg: string;
  text: string;
  dot: string;
}

export interface TagOverride {
  label?: string;
  colorId?: string;
}

export type TagOverrideMap = Record<string, Record<string, TagOverride>>;

export interface ResolvedTag {
  label: string;
  bg: string;
  text: string;
  dot: string;
  colorId?: string;
}

export interface TagPatch {
  label: string;
  colorId?: string;
}

export const TAG_COLORS: TagColor[] = [
  { id: 'gray', name: 'Gris', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  { id: 'emerald', name: 'Verde', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { id: 'green', name: 'Verde claro', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-400' },
  { id: 'sky', name: 'Celeste', bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-400' },
  { id: 'blue', name: 'Azul', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  { id: 'purple', name: 'Violeta', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  { id: 'amber', name: 'Ámbar', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  { id: 'yellow', name: 'Amarillo', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  { id: 'orange', name: 'Naranja', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  { id: 'rose', name: 'Rosa', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400' },
  { id: 'red', name: 'Rojo', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
];

const TAG_LABEL_LIMIT = 40;

export function tagOptionsStorageKey(storageKey: string) {
  return `${storageKey}:tagOptions`;
}

export function matchTagColor(tag?: Pick<BadgeMeta, 'bg' | 'text' | 'dot'> | null): TagColor | undefined {
  if (!tag) return undefined;
  return TAG_COLORS.find((color) => color.bg === tag.bg && color.text === tag.text && color.dot === tag.dot);
}

export function readTagOverrides(storageKey: string): TagOverrideMap {
  try {
    const raw = localStorage.getItem(tagOptionsStorageKey(storageKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.entries(parsed as Record<string, unknown>).reduce<TagOverrideMap>((columns, [columnId, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return columns;

      const options = Object.entries(value as Record<string, unknown>).reduce<Record<string, TagOverride>>((acc, [option, override]) => {
        if (!override || typeof override !== 'object' || Array.isArray(override)) return acc;
        const record = override as Record<string, unknown>;
        const next: TagOverride = {};
        if (typeof record.label === 'string' && record.label.trim()) {
          next.label = record.label.trim().slice(0, TAG_LABEL_LIMIT);
        }
        if (typeof record.colorId === 'string' && TAG_COLORS.some((color) => color.id === record.colorId)) {
          next.colorId = record.colorId;
        }
        if (next.label || next.colorId) acc[option] = next;
        return acc;
      }, {});

      if (Object.keys(options).length > 0) columns[columnId] = options;
      return columns;
    }, {});
  } catch {
    return {};
  }
}

export function resolveTag(
  option: string,
  base: BadgeMeta | undefined,
  override: TagOverride | undefined,
): ResolvedTag {
  const color = override?.colorId
    ? TAG_COLORS.find((entry) => entry.id === override.colorId)
    : undefined;
  const label = override?.label?.trim() || base?.label || option;

  return {
    label,
    bg: color?.bg ?? base?.bg ?? 'bg-gray-100',
    text: color?.text ?? base?.text ?? 'text-gray-700',
    dot: color?.dot ?? base?.dot ?? 'bg-gray-400',
    colorId: color?.id ?? matchTagColor(base)?.id,
  };
}

export function normalizeTagLabel(value: string) {
  return value.trim().slice(0, TAG_LABEL_LIMIT);
}
