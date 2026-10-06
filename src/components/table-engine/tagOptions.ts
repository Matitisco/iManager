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
export const CREATED_TAG_LIMIT = 20;

export interface TagOptionsState {
  overrides: TagOverrideMap;
  created: Record<string, string[]>;
  removed: Record<string, string[]>;
}

export function tagOptionsStorageKey(storageKey: string) {
  return `${storageKey}:tagOptions`;
}

export function matchTagColor(tag?: Pick<BadgeMeta, 'bg' | 'text' | 'dot'> | null): TagColor | undefined {
  if (!tag) return undefined;
  return TAG_COLORS.find((color) => color.bg === tag.bg && color.text === tag.text && color.dot === tag.dot);
}

function sanitizeOverrides(value: unknown): TagOverrideMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<TagOverrideMap>((columns, [columnId, columnValue]) => {
    if (!columnValue || typeof columnValue !== 'object' || Array.isArray(columnValue)) return columns;

    const options = Object.entries(columnValue as Record<string, unknown>).reduce<Record<string, TagOverride>>((acc, [option, override]) => {
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
}

function sanitizeCreated(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>((columns, [columnId, options]) => {
    if (!Array.isArray(options)) return columns;
    const next = normalizeCreatedTagValues(options);
    if (next.length > 0) columns[columnId] = next;
    return columns;
  }, {});
}

const REMOVED_TAG_LIMIT = 100;

export function sameTagKey(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function normalizeRemovedTagValues(values: readonly unknown[]) {
  const options: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const label = String(value ?? '').trim().slice(0, REMOVED_TAG_LIMIT);
    const key = label.toLocaleLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    options.push(label);
  }

  return options;
}

function sanitizeRemoved(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>((columns, [columnId, options]) => {
    if (!Array.isArray(options)) return columns;
    const next = normalizeRemovedTagValues(options);
    if (next.length > 0) columns[columnId] = next;
    return columns;
  }, {});
}

export function omitRemovedTags(options: readonly string[], removed: readonly string[]) {
  if (removed.length === 0) return [...options];
  return options.filter((option) => !removed.some((hidden) => sameTagKey(hidden, option)));
}

export function readTagOptions(storageKey: string): TagOptionsState {
  try {
    const raw = localStorage.getItem(tagOptionsStorageKey(storageKey));
    if (!raw) return { overrides: {}, created: {}, removed: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { overrides: {}, created: {}, removed: {} };

    const record = parsed as Record<string, unknown>;
    if (record.v === 2) {
      return {
        overrides: sanitizeOverrides(record.overrides),
        created: sanitizeCreated(record.created),
        removed: sanitizeRemoved(record.removed),
      };
    }

    return { overrides: sanitizeOverrides(parsed), created: {}, removed: {} };
  } catch {
    return { overrides: {}, created: {}, removed: {} };
  }
}

export function readTagOverrides(storageKey: string): TagOverrideMap {
  return readTagOptions(storageKey).overrides;
}

export function writeTagOptions(storageKey: string, state: TagOptionsState) {
  localStorage.setItem(tagOptionsStorageKey(storageKey), JSON.stringify({
    v: 2,
    overrides: state.overrides,
    created: state.created,
    removed: state.removed,
  }));
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

export function normalizeCreatedTagValue(value: string) {
  return value.trim().slice(0, CREATED_TAG_LIMIT);
}

export function normalizeCreatedTagValues(values: readonly unknown[]) {
  const options: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const label = normalizeCreatedTagValue(String(value ?? ''));
    const key = label.toLocaleLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    options.push(label);
  }

  return options;
}

export function mergeDropdownOptions(base: readonly string[], extra: readonly string[], current?: string) {
  const merged: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const label = value.trim();
    const key = label.toLocaleLowerCase();
    if (!label || seen.has(key)) return;
    seen.add(key);
    merged.push(label);
  };

  for (const option of base) push(option);
  for (const option of extra) push(option);
  if (current) push(current);
  return merged;
}
