import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef, TableColumnPreferenceState, TableData } from '../types';

const STORAGE_PREFIX = 'table-engine:column-prefs';

function buildPreferenceState<TData extends TableData>(
  initialColumns: ColumnDef<TData>[],
  prefs?: TableColumnPreferenceState | null,
): TableColumnPreferenceState {
  const order = prefs?.order?.length
    ? [
        ...prefs.order.filter((columnId) => initialColumns.some((column) => column.id === columnId)),
        ...initialColumns
          .map((column) => column.id)
          .filter((columnId) => !prefs.order.includes(columnId)),
      ]
    : initialColumns.map((column) => column.id);

  const visibility = initialColumns.reduce<Record<string, boolean>>((acc, column) => {
    acc[column.id] = prefs?.visibility?.[column.id] ?? column.visible !== false;
    return acc;
  }, {});

  const widths = { ...(prefs?.widths ?? {}) };
  const labels = { ...(prefs?.labels ?? {}) };

  return {
    order,
    visibility,
    widths,
    labels,
  };
}

function applyPreferences<TData extends TableData>(
  initialColumns: ColumnDef<TData>[],
  prefs: TableColumnPreferenceState,
): ColumnDef<TData>[] {
  const byId = new Map(initialColumns.map((column) => [column.id, column]));

  return prefs.order
    .map((columnId) => byId.get(columnId))
    .filter((column): column is ColumnDef<TData> => Boolean(column))
    .map((column) => ({
      ...column,
      visible: prefs.visibility[column.id] ?? column.visible,
      width: prefs.widths?.[column.id] ?? column.width,
      header:
        typeof column.header === 'string'
          ? (prefs.labels?.[column.id] ?? column.header)
          : column.header,
    }));
}

export function useColumnCustomization<TData extends TableData>(
  initialColumns: ColumnDef<TData>[],
  options?: {
    viewId?: string;
    onColumnPreferencesChange?: (next: TableColumnPreferenceState) => void;
  },
) {
  const storageKey = options?.viewId ? `${STORAGE_PREFIX}:${options.viewId}` : null;

  const [preferences, setPreferences] = useState<TableColumnPreferenceState>(() => {
    if (typeof window !== 'undefined' && storageKey) {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          return buildPreferenceState(initialColumns, JSON.parse(raw) as TableColumnPreferenceState);
        }
      } catch {
        // Ignore malformed localStorage state and fall back to defaults.
      }
    }

    return buildPreferenceState(initialColumns);
  });

  useEffect(() => {
    setPreferences((current) => {
      const next = buildPreferenceState(initialColumns, current);
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [initialColumns]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      // Persisting preferences should never block rendering.
    }
  }, [preferences, storageKey]);

  useEffect(() => {
    options?.onColumnPreferencesChange?.(preferences);
  }, [options, preferences]);

  const columns = useMemo(() => applyPreferences(initialColumns, preferences), [initialColumns, preferences]);

  const visibleColumns = useMemo(() => {
    return columns.filter((col) => col.visible !== false);
  }, [columns]);

  const updatePreferences = useCallback(
    (updater: (current: TableColumnPreferenceState) => TableColumnPreferenceState) => {
      setPreferences((current) => updater(current));
    },
    [],
  );

  const toggleColumnVisibility = useCallback((columnId: string) => {
    updatePreferences((current) => ({
      ...current,
      visibility: {
        ...current.visibility,
        [columnId]: !(current.visibility[columnId] ?? true),
      },
    }));
  }, [updatePreferences]);

  const reorderColumn = useCallback((startIndex: number, endIndex: number) => {
    updatePreferences((current) => {
      const nextOrder = Array.from(current.order);
      const [removed] = nextOrder.splice(startIndex, 1);
      nextOrder.splice(endIndex, 0, removed);
      return { ...current, order: nextOrder };
    });
  }, [updatePreferences]);

  const reorderColumnById = useCallback((sourceColumnId: string, targetColumnId: string) => {
    updatePreferences((current) => {
      const nextOrder = Array.from(current.order);
      const sourceIndex = nextOrder.indexOf(sourceColumnId);
      const targetIndex = nextOrder.indexOf(targetColumnId);

      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return current;
      }

      const [removed] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, removed);
      return { ...current, order: nextOrder };
    });
  }, [updatePreferences]);

  const resizeColumn = useCallback((columnId: string, width: string | number) => {
    updatePreferences((current) => ({
      ...current,
      widths: {
        ...current.widths,
        [columnId]: width,
      },
    }));
  }, [updatePreferences]);

  const renameColumn = useCallback((columnId: string, label: string) => {
    updatePreferences((current) => ({
      ...current,
      labels: {
        ...current.labels,
        [columnId]: label,
      },
    }));
  }, [updatePreferences]);

  const resetColumnPreferences = useCallback(() => {
    const reset = buildPreferenceState(initialColumns);
    setPreferences(reset);
  }, [initialColumns]);

  return {
    columns,
    visibleColumns,
    preferences,
    toggleColumnVisibility,
    reorderColumn,
    reorderColumnById,
    resizeColumn,
    renameColumn,
    resetColumnPreferences,
  };
}
