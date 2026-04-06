import type { User } from 'firebase/auth';
import type { Product } from '../types';
import {
  bulkMoveCategoryApi,
  deleteBackendInventoryItem,
  fetchInventoryFilteredIds,
  fetchInventoryPage,
  type InventoryPageParams,
  updateBackendInventoryItem,
} from './inventory-api';
import type {
  TableColumnPreferenceState,
  TableRemoteDataAdapter,
  TableRemoteQuery,
  TableRowId,
} from '../components/TableEngine/types';

export type InventoryTableFilterParams = Omit<InventoryPageParams, 'skip' | 'take'>;

export async function loadInventoryTablePage(
  user: User,
  params: InventoryTableFilterParams,
  skip: number,
  take: number,
) {
  const result = await fetchInventoryPage(user, { skip, take, ...params });

  return {
    rows: result.items,
    total: result.total,
    hasNextPage: skip + result.items.length < result.total,
  };
}

export async function loadInventoryTableFilteredIds(
  user: User,
  params: InventoryTableFilterParams,
) {
  return fetchInventoryFilteredIds(user, params);
}

export async function exportInventoryTableRows(
  user: User,
  total: number,
  params: InventoryTableFilterParams,
  visibleColumns: string[],
  columnLabels: Record<string, string>,
  defaultLabels: Record<string, string>,
  fieldMap: Partial<Record<string, string>>,
) {
  const result = await fetchInventoryPage(user, { skip: 0, take: total, ...params });

  const rows = result.items.map((item: Product) => {
    const row: Record<string, string | number> = {};
    visibleColumns.forEach((columnId) => {
      const label = columnLabels[columnId] || defaultLabels[columnId] || columnId;
      const field = fieldMap[columnId];
      const rawValue = field ? (item as unknown as Record<string, unknown>)[field] : undefined;
      row[label] = rawValue == null || rawValue === '' || rawValue === '---' ? '' : (rawValue as string | number);
    });
    return row;
  });

  const { utils, writeFile } = await import('xlsx');
  const ws = utils.json_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Inventario');
  const fecha = new Date().toISOString().slice(0, 10);
  writeFile(wb, `inventory_${fecha}.xlsx`);
}

export async function updateInventoryTableRow(user: User, row: Product) {
  return updateBackendInventoryItem(user, row);
}

export async function deleteInventoryTableRow(user: User, rowId: string) {
  await deleteBackendInventoryItem(user, rowId);
}

export async function bulkMoveInventoryTableRows(
  user: User,
  rowIds: string[],
  categoryId: string | null,
) {
  return bulkMoveCategoryApi(user, rowIds, categoryId);
}

const COLUMN_PREFERENCES_STORAGE_PREFIX = 'inventory:table-engine:column-prefs';

export function loadInventoryColumnPreferences(viewId?: string): TableColumnPreferenceState | null {
  if (typeof window === 'undefined' || !viewId) return null;

  try {
    const raw = window.localStorage.getItem(`${COLUMN_PREFERENCES_STORAGE_PREFIX}:${viewId}`);
    return raw ? (JSON.parse(raw) as TableColumnPreferenceState) : null;
  } catch {
    return null;
  }
}

export function saveInventoryColumnPreferences(
  viewId: string | undefined,
  next: TableColumnPreferenceState,
) {
  if (typeof window === 'undefined' || !viewId) return;

  try {
    window.localStorage.setItem(`${COLUMN_PREFERENCES_STORAGE_PREFIX}:${viewId}`, JSON.stringify(next));
  } catch {
    // Preference persistence must not block inventory usage.
  }
}

export interface InventoryTableAdapterHelpers {
  fetchPage: TableRemoteDataAdapter<Product>['fetchPage'];
  fetchFilteredIds: TableRemoteDataAdapter<Product>['fetchFilteredIds'];
  persistColumnPreferences: TableRemoteDataAdapter<Product>['persistColumnPreferences'];
  exportRows: TableRemoteDataAdapter<Product>['exportRows'];
}

export function createInventoryTableAdapter(
  user: User,
  options?: {
    viewId?: string;
    fieldMap?: Partial<Record<string, string>>;
    defaultLabels?: Record<string, string>;
  },
): TableRemoteDataAdapter<Product> & InventoryTableAdapterHelpers {
  const fetchPage: TableRemoteDataAdapter<Product>['fetchPage'] = async (query: TableRemoteQuery) => {
    const pagination = query.pagination;
    const pageIndex = pagination?.pageIndex ?? 1;
    const pageSize = pagination?.pageSize ?? 30;
    const skip = Math.max(0, (pageIndex - 1) * pageSize);

    const result = await loadInventoryTablePage(
      user,
      {
        categoryId: undefined,
        sortKey: query.sorting?.columnId,
        sortDir: query.sorting?.direction ?? undefined,
        condition: query.filters?.values?.condition as string | undefined,
        status: query.filters?.values?.status as string | undefined,
        capacity: query.filters?.values?.capacity as string | undefined,
        model: query.filters?.values?.model as string | undefined,
        grade: query.filters?.values?.grade as string | undefined,
        battery: query.filters?.values?.battery as string | undefined,
      },
      skip,
      pageSize,
    );

    return {
      rows: result.rows,
      totalItems: result.total,
      totalPages: Math.ceil(result.total / pageSize),
      hasNextPage: result.hasNextPage,
    };
  };

  const fetchFilteredIds: TableRemoteDataAdapter<Product>['fetchFilteredIds'] = async (query: TableRemoteQuery) => {
    return loadInventoryTableFilteredIds(user, {
      categoryId: undefined,
      condition: query.filters?.values?.condition as string | undefined,
      status: query.filters?.values?.status as string | undefined,
      capacity: query.filters?.values?.capacity as string | undefined,
      model: query.filters?.values?.model as string | undefined,
      grade: query.filters?.values?.grade as string | undefined,
      battery: query.filters?.values?.battery as string | undefined,
    });
  };

  const persistColumnPreferences: TableRemoteDataAdapter<Product>['persistColumnPreferences'] = async (next) => {
    saveInventoryColumnPreferences(options?.viewId, next);
  };

  const exportRows: TableRemoteDataAdapter<Product>['exportRows'] = async (context) => {
    await exportInventoryTableRows(
      user,
      context.rows.length,
      {
        categoryId: undefined,
        sortKey: context.query?.sorting?.columnId,
        sortDir: context.query?.sorting?.direction ?? undefined,
        condition: context.query?.filters?.values?.condition as string | undefined,
        status: context.query?.filters?.values?.status as string | undefined,
        capacity: context.query?.filters?.values?.capacity as string | undefined,
        model: context.query?.filters?.values?.model as string | undefined,
        grade: context.query?.filters?.values?.grade as string | undefined,
        battery: context.query?.filters?.values?.battery as string | undefined,
      },
      context.visibleColumns.map((column) => column.id),
      {},
      options?.defaultLabels ?? {},
      options?.fieldMap ?? {},
    );
  };

  return {
    mode: 'remote',
    fetchPage,
    fetchFilteredIds,
    persistColumnPreferences,
    exportRows,
  };
}
