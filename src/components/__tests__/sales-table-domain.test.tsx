import { describe, expect, it, vi } from 'vitest';
import type { Client, Product, Sale } from '../../types';
import {
  buildSalesExportRows,
  buildSalesTableColumns,
  buildSalesTablePlugin,
  buildSalesTableRows,
  sortSalesRows,
} from '../sales-table-domain';

const sales: Sale[] = [
  {
    id: 'S-2',
    date: '2026-04-05',
    clientId: 'C-2',
    productId: 'P-2',
    amount: 150000,
    paymentMethod: 'EFECTIVO',
    status: 'PENDIENTE',
  },
  {
    id: 'S-1',
    date: '2026-04-01',
    clientId: 'C-1',
    productId: 'P-1',
    amount: 250000,
    paymentMethod: 'TRANSFERENCIA',
    status: 'COMPLETADA',
  },
];

const clients: Client[] = [
  {
    id: 'C-1',
    dni: '12345678',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '1111-1111',
    lastPurchaseDate: '2026-04-01',
    totalSpent: 250000,
    pendingBalance: 0,
  },
];

const inventory: Product[] = [
  {
    id: 'P-1',
    imei: '111',
    model: 'iPhone 15',
    capacity: '256GB',
    color: 'Black',
    condition: 'NUEVO',
    grade: 'A+',
    batteryHealth: '100%',
    cost: 180000,
    price: 250000,
    status: 'VENDIDO',
  },
];

describe('sales-table-domain', () => {
  it('builds display rows with client and product fallbacks', () => {
    const rows = buildSalesTableRows(sales, clients, inventory);

    expect(rows).toHaveLength(2);
    expect(rows[0].client).toBe('Cliente eliminado');
    expect(rows[0].product).toBe('Producto eliminado');
    expect(rows[1].client).toBe('Ada Lovelace');
    expect(rows[1].clientMeta).toBe('DNI 12345678');
    expect(rows[1].product).toBe('iPhone 15 256GB');
    expect(rows[1].productMeta).toBe('IMEI: 111');
  });

  it('describes the sales table columns required by the engine', () => {
    const columns = buildSalesTableColumns();

    expect(columns.map((column) => column.id)).toEqual([
      'id',
      'date',
      'client',
      'product',
      'amount',
      'paymentMethod',
      'status',
    ]);
    expect(columns.find((column) => column.id === 'paymentMethod')?.type).toBe('enum');
    expect(columns.find((column) => column.id === 'status')?.editable).toBe(true);
    expect(columns.find((column) => column.id === 'amount')?.editable).toBe(true);
  });

  it('sorts rows by the active engine sort column', () => {
    const rows = buildSalesTableRows(sales, clients, inventory);
    const sortedByAmount = sortSalesRows(rows, { columnId: 'amount', direction: 'asc' });

    expect(sortedByAmount.map((row) => row.id)).toEqual(['S-2', 'S-1']);
  });

  it('builds export rows using visible columns and custom labels', () => {
    const rows = buildSalesTableRows(sales, clients, inventory);
    const exportRows = buildSalesExportRows(rows, ['date', 'client', 'amount'], {
      client: 'Cliente',
      amount: 'Importe',
    });

    expect(exportRows).toEqual([
      { Fecha: '2026-04-05', Cliente: 'Cliente eliminado', Importe: 150000 },
      { Fecha: '2026-04-01', Cliente: 'Ada Lovelace', Importe: 250000 },
    ]);
  });

  it('exposes row and bulk actions for context menu workflows', () => {
    const onEditSale = vi.fn();
    const onDeleteSale = vi.fn();
    const onBulkDeleteSales = vi.fn();

    const plugin = buildSalesTablePlugin({
      onEditSale,
      onDeleteSale,
      onBulkDeleteSales,
    });

    expect(plugin.rowActions?.map((action) => action.id)).toEqual(['edit-sale', 'delete-sale']);
    expect(plugin.bulkActions?.map((action) => action.id)).toEqual(['bulk-delete-sales']);

    const rows = buildSalesTableRows(sales, clients, inventory);

    plugin.rowActions?.[0].run(rows[0]);
    plugin.rowActions?.[1].run(rows[1]);
    plugin.bulkActions?.[0].run({ selectedIds: ['S-1'] } as never, [rows[1]]);

    expect(onEditSale).toHaveBeenCalledWith(rows[0]);
    expect(onDeleteSale).toHaveBeenCalledWith(rows[1]);
    expect(onBulkDeleteSales).toHaveBeenCalledWith([rows[1]], ['S-1']);
  });
});
