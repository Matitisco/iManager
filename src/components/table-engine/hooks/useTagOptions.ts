import { useEffect, useRef, useState } from 'react';
import type { BadgeMeta } from '../types';
import {
  normalizeTagLabel,
  readTagOverrides,
  resolveTag,
  tagOptionsStorageKey,
  type ResolvedTag,
  type TagOverrideMap,
  type TagPatch,
} from '../tagOptions';

export function useTagOptions(storageKey: string) {
  const [overrides, setOverrides] = useState<TagOverrideMap>(() => readTagOverrides(storageKey));
  const storageKeyRef = useRef(storageKey);

  useEffect(() => {
    if (storageKeyRef.current !== storageKey) {
      storageKeyRef.current = storageKey;
      setOverrides(readTagOverrides(storageKey));
      return;
    }

    localStorage.setItem(tagOptionsStorageKey(storageKey), JSON.stringify(overrides));
  }, [storageKey, overrides]);

  const resolve = (columnId: string, option: string, base?: BadgeMeta): ResolvedTag =>
    resolveTag(option, base, overrides[columnId]?.[option]);

  const labelFor = (columnId: string, option: string, fallback: string) =>
    overrides[columnId]?.[option]?.label || fallback;

  const save = (columnId: string, option: string, patch: TagPatch) => {
    const label = normalizeTagLabel(patch.label);
    if (!label) return;

    setOverrides((prev) => {
      const column = { ...(prev[columnId] ?? {}) };
      const current = { ...(column[option] ?? {}) };
      current.label = label;
      if (patch.colorId) current.colorId = patch.colorId;
      column[option] = current;
      return { ...prev, [columnId]: column };
    });
  };

  return { resolve, save, labelFor };
}
