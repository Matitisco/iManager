import { useEffect, useRef, useState } from 'react';
import type { BadgeMeta } from '../types';
import {
  mergeDropdownOptions,
  normalizeCreatedTagValue,
  normalizeTagLabel,
  omitRemovedTags,
  readTagOptions,
  resolveTag,
  sameTagKey,
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

  const createdFor = (columnId: string) =>
    omitRemovedTags(state.created[columnId] ?? [], state.removed[columnId] ?? []);

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
    const removed = state.removed[columnId] ?? [];
    const visibleValues = values.filter((value) =>
      (current ? sameTagKey(value, current) : false) || !removed.some((hidden) => sameTagKey(hidden, value)),
    );

    return [
      ...blanks,
      ...visibleValues.map((value) => {
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

  const removedFor = (columnId: string) => state.removed[columnId] ?? [];

  const dropRemoved = (removed: Record<string, string[]>, columnId: string, option: string) => {
    const nextRemoved = (removed[columnId] ?? []).filter((entry) => !sameTagKey(entry, option));
    const next = { ...removed };
    if (nextRemoved.length > 0) next[columnId] = nextRemoved;
    else delete next[columnId];
    return next;
  };

  const remove = (columnId: string, option: string) => {
    const key = option.trim();
    if (!key) return;

    setState((prev) => {
      const columnRemoved = prev.removed[columnId] ?? [];
      const nextRemoved = columnRemoved.some((entry) => sameTagKey(entry, key))
        ? columnRemoved
        : [...columnRemoved, key];
      const nextCreated = (prev.created[columnId] ?? []).filter((entry) => !sameTagKey(entry, key));
      const created = { ...prev.created };
      if (nextCreated.length > 0) created[columnId] = nextCreated;
      else delete created[columnId];

      return {
        ...prev,
        created,
        removed: { ...prev.removed, [columnId]: nextRemoved },
      };
    });
  };

  const create = (columnId: string, rawLabel: string, colorId: string | undefined, existing: readonly string[]) => {
    const label = normalizeCreatedTagValue(rawLabel);
    if (!label) return null;
    if (colorId && !TAG_COLORS.some((color) => color.id === colorId)) return null;

    const removed = state.removed[columnId] ?? [];
    const restoreTarget = removed.find((option) => {
      if (sameTagKey(option, label)) return true;
      const overrideLabel = state.overrides[columnId]?.[option]?.label;
      return !!overrideLabel && sameTagKey(overrideLabel, label);
    });

    if (restoreTarget) {
      const inBase = existing.some((option) => sameTagKey(option, restoreTarget));
      setState((prev) => {
        const columnOverrides = { ...(prev.overrides[columnId] ?? {}) };
        const current = { ...(columnOverrides[restoreTarget] ?? {}) };
        current.label = normalizeTagLabel(label) || current.label || restoreTarget;
        if (colorId) current.colorId = colorId;
        columnOverrides[restoreTarget] = current;

        const created = { ...prev.created };
        if (!inBase) {
          created[columnId] = mergeDropdownOptions(prev.created[columnId] ?? [], [restoreTarget]);
        }

        return {
          overrides: { ...prev.overrides, [columnId]: columnOverrides },
          created,
          removed: dropRemoved(prev.removed, columnId, restoreTarget),
        };
      });
      return restoreTarget;
    }

    const hidden = new Set(removed.map((option) => option.trim().toLocaleLowerCase()));
    const taken = new Set<string>();
    const claim = (value?: string) => {
      const key = value?.trim().toLocaleLowerCase();
      if (key) taken.add(key);
    };
    for (const option of existing) {
      if (hidden.has(option.trim().toLocaleLowerCase())) continue;
      claim(option);
      claim(state.overrides[columnId]?.[option]?.label);
    }
    for (const option of state.created[columnId] ?? []) {
      if (hidden.has(option.trim().toLocaleLowerCase())) continue;
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
        removed: dropRemoved(prev.removed, columnId, label),
      };
    });
    return label;
  };

  return { resolve, save, labelFor, createdFor, choices, create, remove, removedFor };
}
