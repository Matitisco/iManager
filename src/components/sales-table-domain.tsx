import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import type { Client, Product, Sale } from '../types';
import type {
  ColumnDef,
  TableBulkAction,
  TableColumnPreferenceState,
  TablePlugin,
  TableSortState,
} from './TableEngine/types';

export const SALES_TABLE_VIEW_ID = 'sales-table';
const TABLE_COLUMN_PREFS_STORAGE_PREFIX = 'table-engine:column-prefs';

export type SalesTableColumnId =
  | 'id'
  | 'date'
  | 'client'
  | 'product'
  | 'amount'
  | 'paymentMethod'
  | 'status';

export type SalesTableRow = Sale & {
  client: string;
  clientMeta: string;
  product: string;
  productMeta: string;
};

export const SALES_TABLE_DEFAULT_LABELS: Record<SalesTableColumnId, string> = {
  id: 'ID Venta',
  date: 'Fecha',
  client: 'Cliente',
  product: 'Modelo / IMEI',
  amount: 'Monto',
  paymentMethod: 'Pago',
  status: 'Estado',
};

const PAYMENT_METHOD_OPTIONS = ['TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'CANJE / PAGO', 'T. Crédito'];
const STATUS_OPTIONS = ['COMPLETADA', 'PENDIENTE'];

function isMissingValue(value: unknown) {
  return value === null || value === undefined || value === '';
}

export function buildSalesTableRows(
  sales: Sale[],
  clients: Client[],
  inventory: Product[],
): SalesTableRow[] {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const productById = new Map(inventory.map((product) => [product.id, product]));

  return sales.map((sale) => {
    const client = clientById.get(sale.clientId);
    const product = productById.get(sale.productId);

    return {
      ...sale,
      client: client?.name || 'Cliente eliminado',
      clientMeta: client?.dni ? `DNI ${client.dni}` : 'Sin DNI disponible',
      product: product ? `${product.model} ${product.capacity}`.trim() : 'Producto eliminado',
      productMeta: product?.imei ? `IMEI: ${product.imei}` : 'IMEI no disponible',
    };
  });
}

export function buildSalesTableColumns(): ColumnDef<SalesTableRow>[] {
  return [
    {
      id: 'id',
      header: SALES_TABLE_DEFAULT_LABELS.id,
      accessorKey: 'id',
      sortable: true,
      editable: false,
      cell: ({ value }) => <span className="font-mono text-xs text-gray-500">{String(value)}</span>,
    },
    {
      id: 'date',
      header: SALES_TABLE_DEFAULT_LABELS.date,
      accessorKey: 'date',
      sortable: true,
      editable: true,
      type: 'date',
      placeholder: { value: '---', treatEmptyStringAsMissing: true },
      cell: ({ value, placeholder }) => (
        <span className={placeholder ? 'text-gray-300' : 'text-gray-700'}>{String(value ?? placeholder ?? '---')}</span>
      ),
    },
    {
      id: 'client',
      header: SALES_TABLE_DEFAULT_LABELS.client,
      accessorKey: 'client',
      sortable: true,
      editable: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium text-gray-900 truncate">{row.client}</div>
          <div className="text-xs text-gray-400 truncate">{row.clientMeta}</div>
        </div>
      ),
    },
    {
      id: 'product',
      header: SALES_TABLE_DEFAULT_LABELS.product,
      accessorKey: 'product',
      sortable: true,
      editable: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 truncate">{row.product}</div>
          <div className="text-xs text-gray-400 truncate">{row.productMeta}</div>
        </div>
      ),
    },
    {
      id: 'amount',
      header: SALES_TABLE_DEFAULT_LABELS.amount,
      accessorKey: 'amount',
      sortable: true,
      editable: true,
      type: 'currency',
      cell: ({ value }) => (
        <span className="font-bold text-gray-900">
          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
            Number(value ?? 0),
          )}
        </span>
      ),
    },
    {
      id: 'paymentMethod',
      header: SALES_TABLE_DEFAULT_LABELS.paymentMethod,
      accessorKey: 'paymentMethod',
      sortable: true,
      editable: true,
      type: 'enum',
      enumOptions: PAYMENT_METHOD_OPTIONS.map((option) => ({ label: option, value: option })),
      cell: ({ value }) => {
        const method = String(value ?? '');
        return (
          <span className={`px-3 py-1 text-xs font-bold rounded-md uppercase tracking-wide ${
            method === 'EFECTIVO' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
          }`}>
            {method || '---'}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: SALES_TABLE_DEFAULT_LABELS.status,
      accessorKey: 'status',
      sortable: true,
      editable: true,
      type: 'enum',
      enumOptions: STATUS_OPTIONS.map((option) => ({ label: option, value: option })),
      cell: ({ value }) => {
        const status = String(value ?? '');
        const tone =
          status === 'COMPLETADA'
            ? 'bg-emerald-100 text-emerald-700'
            : status === 'PENDIENTE'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-500';

        return (
          <span className={`px-3 py-1 text-xs font-bold rounded-md uppercase tracking-wide ${tone}`}>
            {status || '---'}
          </span>
        );
      },
    },
  ];
}

export function buildSalesTablePlugin(args: {
  onEditSale: (sale: SalesTableRow) => void;
  onDeleteSale: (sale: SalesTableRow) => void;
  onBulkDeleteSales: (sales: SalesTableRow[], selectionIds: string[]) => void;
}): TablePlugin<SalesTableRow> {
  const rowActions = [
    {
      id: 'edit-sale',
      label: (
        <span className="flex items-center gap-2">
          <Edit2 size={14} />
          Editar venta
        </span>
      ),
      run: (row: SalesTableRow) => args.onEditSale(row),
    },
    {
      id: 'delete-sale',
      label: (
        <span className="flex items-center gap-2">
          <Trash2 size={14} />
          Eliminar
        </span>
      ),
      run: (row: SalesTableRow) => args.onDeleteSale(row),
    },
  ];

  const bulkActions: TableBulkAction<SalesTableRow>[] = [
    {
      id: 'bulk-delete-sales',
      label: (
        <span className="flex items-center gap-2">
          <Trash2 size={14} />
          Eliminar seleccionadas
        </span>
      ),
      run: (_, rows) => args.onBulkDeleteSales(rows, rows.map((row) => row.id)),
    },
  ];

  return {
    id: 'sales-table-plugin',
    rowActions,
    bulkActions,
  };
}

export function loadSalesColumnPreferences(viewId: string | undefined): TableColumnPreferenceState | null {
  if (typeof window === 'undefined' || !viewId) return null;

  try {
    const raw = window.localStorage.getItem(`${TABLE_COLUMN_PREFS_STORAGE_PREFIX}:${viewId}`);
    return raw ? (JSON.parse(raw) as TableColumnPreferenceState) : null;
  } catch {
    return null;
  }
}

export function sortSalesRows(rows: SalesTableRow[], sorting?: TableSortState | null): SalesTableRow[] {
  if (!sorting?.columnId || !sorting.direction) return rows;

  const directionFactor = sorting.direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) => {
    const columnKey = sorting.columnId as keyof SalesTableRow;
    const leftValue = left[columnKey] ?? '';
    const rightValue = right[columnKey] ?? '';

    if (isMissingValue(leftValue) && isMissingValue(rightValue)) return 0;
    if (isMissingValue(leftValue)) return -1 * directionFactor;
    if (isMissingValue(rightValue)) return 1 * directionFactor;

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return (leftValue - rightValue) * directionFactor;
    }

    const comparison = String(leftValue).localeCompare(String(rightValue), 'es', {
      numeric: true,
      sensitivity: 'base',
    });

    return comparison * directionFactor;
  });
}

export function buildSalesExportRows(
  rows: SalesTableRow[],
  visibleColumns: SalesTableColumnId[],
  labels: Partial<Record<SalesTableColumnId, string>>,
) {
  return rows.map((row) => {
    const exportRow: Record<string, string | number> = {};

    visibleColumns.forEach((columnId) => {
      const label = labels[columnId] || SALES_TABLE_DEFAULT_LABELS[columnId] || columnId;
      const rawValue = row[columnId as keyof SalesTableRow];
      exportRow[label] = isMissingValue(rawValue) ? '' : (rawValue as string | number);
    });

    return exportRow;
  });
}

export function getVisibleSalesColumns(
  preferences: TableColumnPreferenceState | null,
  columns: ColumnDef<SalesTableRow>[],
): SalesTableColumnId[] {
  const columnIds = columns.map((column) => column.id as SalesTableColumnId);
  const preferredOrder = (preferences?.order?.length ? preferences.order : columnIds) as string[];

  return preferredOrder.filter((columnId): columnId is SalesTableColumnId => {
    const normalized = columnId as SalesTableColumnId;
    if (!columnIds.includes(normalized)) return false;
    return preferences?.visibility?.[normalized] !== false;
  });
}
