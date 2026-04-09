import { useState, useEffect } from 'react';
import type { ColDef, WithId } from '../types';

function parseStoredObject(value: string | null): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function parseStoredBooleanMap(value: string | null): Record<string, boolean> {
  return Object.entries(parseStoredObject(value)).reduce<Record<string, boolean>>((acc, [key, storedValue]) => {
    if (typeof storedValue === 'boolean') {
      acc[key] = storedValue;
    }

    return acc;
  }, {});
}

function parseStoredNumberMap(value: string | null): Record<string, number> {
  return Object.entries(parseStoredObject(value)).reduce<Record<string, number>>((acc, [key, storedValue]) => {
    if (typeof storedValue === 'number' && Number.isFinite(storedValue)) {
      acc[key] = storedValue;
    }

    return acc;
  }, {});
}

function parseStoredStringMap(value: string | null): Record<string, string> {
  return Object.fromEntries(
    Object.entries(parseStoredObject(value))
      .filter(([, storedValue]) => storedValue != null)
      .map(([key, storedValue]) => [key, String(storedValue)])
  );
}

function parseStoredStringArray(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function useColumnState<TRow extends WithId>(
  storageKey: string,
  columns: ColDef<TRow>[]
) {
  const ALL_COL_IDS = columns.map(c => c.id);
  const DEFAULT_COL_NAMES: Record<string, string> = Object.fromEntries(columns.map(c => [c.id, c.label]));
  const DEFAULT_COL_WIDTHS: Record<string, number> = Object.fromEntries(columns.map(c => [c.id, c.defaultWidth]));

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const parsed = parseStoredBooleanMap(localStorage.getItem(`${storageKey}:visibleCols`));
      return Object.keys(parsed).length > 0 ? parsed : Object.fromEntries(columns.map(c => [c.id, true]));
    } catch { return Object.fromEntries(columns.map(c => [c.id, true])); }
  });

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const parsed = parseStoredNumberMap(localStorage.getItem(`${storageKey}:colWidths`));
      return { ...DEFAULT_COL_WIDTHS, ...parsed };
    } catch { return { ...DEFAULT_COL_WIDTHS }; }
  });

  const [colOrder, setColOrder] = useState<string[]>(() => {
    try {
      const parsed = parseStoredStringArray(localStorage.getItem(`${storageKey}:colOrder`));
      if (parsed.length > 0) {
        const missing = ALL_COL_IDS.filter(c => !parsed.includes(c));
        return [...parsed, ...missing];
      }
    } catch {}
    return [...ALL_COL_IDS];
  });

  const [colNames, setColNames] = useState<Record<string, string>>(() => {
    try { return parseStoredStringMap(localStorage.getItem(`${storageKey}:colNames`)); }
    catch { return {}; }
  });

  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    setVisibleColumns((prev) => {
      const next = Object.fromEntries(
        ALL_COL_IDS.map((colId) => [colId, prev[colId] ?? true])
      );

      const changed =
        Object.keys(prev).length !== Object.keys(next).length ||
        ALL_COL_IDS.some((colId) => prev[colId] !== next[colId]);

      return changed ? next : prev;
    });
  }, [storageKey, ALL_COL_IDS.join('|')]);

  useEffect(() => {
    setColWidths((prev) => {
      const next = Object.fromEntries(
        ALL_COL_IDS.map((colId) => [colId, prev[colId] ?? DEFAULT_COL_WIDTHS[colId]])
      );

      const changed = ALL_COL_IDS.some((colId) => prev[colId] !== next[colId])
        || Object.keys(prev).length !== Object.keys(next).length;

      return changed ? next : prev;
    });
  }, [storageKey, ALL_COL_IDS.join('|')]);

  useEffect(() => {
    setColOrder((prev) => {
      const filtered = prev.filter((colId) => ALL_COL_IDS.includes(colId));
      const missing = ALL_COL_IDS.filter((colId) => !filtered.includes(colId));
      const next = [...filtered, ...missing];
      const changed = next.length !== prev.length || next.some((colId, index) => prev[index] !== colId);
      return changed ? next : prev;
    });
  }, [storageKey, ALL_COL_IDS.join('|')]);

  useEffect(() => {
    setColNames((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([colId]) => ALL_COL_IDS.includes(colId))
      );
      const changed = Object.keys(prev).length !== Object.keys(next).length;
      return changed ? next : prev;
    });
  }, [storageKey, ALL_COL_IDS.join('|')]);

  useEffect(() => { localStorage.setItem(`${storageKey}:visibleCols`, JSON.stringify(visibleColumns)); }, [storageKey, visibleColumns]);
  useEffect(() => { localStorage.setItem(`${storageKey}:colWidths`, JSON.stringify(colWidths)); }, [storageKey, colWidths]);
  useEffect(() => { localStorage.setItem(`${storageKey}:colOrder`, JSON.stringify(colOrder)); }, [storageKey, colOrder]);
  useEffect(() => { localStorage.setItem(`${storageKey}:colNames`, JSON.stringify(colNames)); }, [storageKey, colNames]);

  const toggleColumn = (key: string) =>
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

  const commitColRename = (col: string) => {
    const trimmed = String(renameValue ?? '').trim();
    setColNames(prev => {
      if (!trimmed || trimmed === DEFAULT_COL_NAMES[col]) {
        const next = { ...prev }; delete next[col]; return next;
      }
      return { ...prev, [col]: trimmed };
    });
    setRenamingCol(null);
  };

  const ALWAYS_VISIBLE: Set<string> = new Set(columns.filter(c => c.alwaysVisible).map(c => c.id));

  const orderedVisibleCols: string[] = colOrder.filter(col =>
    ALWAYS_VISIBLE.has(col) || visibleColumns[col] !== false
  );

  return {
    ALL_COL_IDS,
    ALWAYS_VISIBLE,
    DEFAULT_COL_NAMES,
    DEFAULT_COL_WIDTHS,
    visibleColumns, setVisibleColumns, toggleColumn,
    colWidths, setColWidths,
    colOrder, setColOrder,
    colNames, setColNames,
    renamingCol, setRenamingCol,
    renameValue, setRenameValue,
    commitColRename,
    orderedVisibleCols,
  };
}
