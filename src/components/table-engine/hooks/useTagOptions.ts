import { useEffect, useRef, useState } from 'react';
import type { BadgeMeta } from '../types';
import {
  mergeDropdownOptions,
  normalizeCreatedTagValue,
  normalizeTagLabel,
  readTagOptions,
  resolveTag,
  TAG_COLORS,
  writeTagOptions,
  type ResolvedTag,
  type TagOptionsState,
  type TagPatch,
} from '../tagOptions';

export function useTagOptions(storageKey: string) {
  const [state, setState] = useState<TagOptionsState>(() => readTagOptions(storageKey));
  const storageKeyRef = useRef(storageKey);

  useEffect(() => {
    if (storageKeyRef.current !== storageKey) {
      storageKeyRef.current = storageKey;
      setState(readTagOptions(storageKey));
      return;
    }

    writeTagOptions(storageKey, state);
  }, [storageKey, state]);

  const resolve = (columnId: string, option: string, base?: BadgeMeta): ResolvedTag =>
    resolveTag(option, base, state.overrides[columnId]?.[option]);

  const labelFor = (columnId: string, option: string, fallback: string) =>
    state.overrides[columnId]?.[option]?.label || fallback;

  const createdFor = (columnId: string) => state.created[columnId] ?? [];

  const choices = (
    columnId: string,
    options: { value: string; label: string }[],
    current?: string,
  ) => {
    const blanks = options.filter((option) => !option.value);
    const valued = options.filter((option) => option.value);
    const values = mergeDropdownOptions(
      valued.map((option) => option.value),
      createdFor(columnId),
      current,
    );

    return [
      ...blanks,
      ...values.map((value) => {
        const existing = valued.find((option) => option.value.toLocaleLowerCase() === value.toLocaleLowerCase());
        return {
          value,
          label: labelFor(columnId, value, existing?.label ?? value),
        };
      }),
    ];
  };

  const save = (columnId: string, option: string, patch: TagPatch) => {
    const label = normalizeTagLabel(patch.label);
    if (!label) return;

    setState((prev) => {
      const column = { ...(prev.overrides[columnId] ?? {}) };
      const current = { ...(column[option] ?? {}) };
      current.label = label;
      if (patch.colorId) current.colorId = patch.colorId;
      column[option] = current;
      return { ...prev, overrides: { ...prev.overrides, [columnId]: column } };
    });
  };

  const create = (columnId: string, rawLabel: string, colorId: string | undefined, existing: readonly string[]) => {
    const label = normalizeCreatedTagValue(rawLabel);
    if (!label) return null;
    if (colorId && !TAG_COLORS.some((color) => color.id === colorId)) return null;

    const taken = new Set<string>();
    const claim = (value?: string) => {
      const key = value?.trim().toLocaleLowerCase();
      if (key) taken.add(key);
    };
    for (const option of existing) {
      claim(option);
      claim(state.overrides[columnId]?.[option]?.label);
    }
    for (const option of state.created[columnId] ?? []) {
      claim(option);
      claim(state.overrides[columnId]?.[option]?.label);
    }
    if (taken.has(label.toLocaleLowerCase())) return null;

    setState((prev) => {
      const columnOverrides = { ...(prev.overrides[columnId] ?? {}) };
      columnOverrides[label] = colorId ? { label, colorId } : { label };
      const columnCreated = mergeDropdownOptions(prev.created[columnId] ?? [], [label]);
      return {
        overrides: { ...prev.overrides, [columnId]: columnOverrides },
        created: { ...prev.created, [columnId]: columnCreated },
      };
    });
    return label;
  };

  return { resolve, save, labelFor, createdFor, choices, create };
}
