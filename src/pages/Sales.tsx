import React, { useMemo } from 'react';
import { TrendingUp, BarChart } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { TableEngine } from '../components/table-engine';
import type { TableEngineConfig } from '../components/table-engine';
import type { Sale, Client, Product } from '../types';
import { formatCurrency } from '../lib/utils';
import { fetchSalesPage, updateSaleViaApi, deleteSaleViaApi, invalidateSalesCache } from '../services/sales-table-api';

// ── Payment method badge metadata ─────────────────────────────────────────────
const PAYMENT_BADGE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  'TRANSFERENCIA': { bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-400',  label: 'Transferencia' },
  'EFECTIVO':      { bg: 'bg-gray-900',  text: 'text-white',     dot: 'bg-gray-400',  label: 'Efectivo' },
  'TARJETA':       { bg: 'bg-purple-50', text: 'text-purple-700',dot: 'bg-purple-400',label: 'Tarjeta' },
  'CANJE / PAGO':  { bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400', label: 'Canje/Pago' },
  'T. Crédito':    { bg: 'bg-rose-50',   text: 'text-rose-700',  dot: 'bg-rose-400',  label: 'T. Crédito' },
};

const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  'COMPLETADA': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', label: 'Completada' },
  'PENDIENTE':  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-400',  label: 'Pendiente' },
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, trend, icon }: { title: string; value: string; trend: string; icon?: React.ReactNode }) => (
  <motion.div
    whileHover={{ y: -4, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
    className="bg-white p-5 rounded-2xl border border-gray-200 h-full transition-shadow cursor-default"
  >
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-xs font-bold text-gray-400 tracking-wider">{title}</h3>
      {icon}
    </div>
    <div className="text-3xl font-black text-gray-900 mb-2">{value}</div>
    <span className="text-xs font-bold text-gray-500">{trend}</span>
  </motion.div>
);

// ── Main component ─────────────────────────────────────────────────────────────
export const Sales: React.FC = () => {
  const {
    user,
    clients,
    inventory,
    sales,
    salesCategories,
    createSaleCategory,
    renameSaleCategory,
    deleteSaleCategory,
    reorderSaleCategories,
    bulkMoveSaleCategory,
    addSale,
    deleteSale
  } = useAppContext();

  // Stats (computed from the cached full list in AppContext)
  const totalRevenue = sales.reduce((sum, s) => sum + s.amount, 0);
  const averageTicket = sales.length > 0 ? totalRevenue / sales.length : 0;
  const totalMargin = sales.reduce((sum, s) => {
    const p = inventory.find(i => i.id === s.productId);
    return sum + (p ? s.amount - p.cost : 0);
  }, 0);
  const marginRate = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  // Build config — closed over clients/inventory for renderCell
  const config = useMemo((): TableEngineConfig<Sale> => ({
    title: 'Ventas',
    storageKey: 'sales',
    exportSheetName: 'Ventas',
    noun: 'venta',
    nounPlural: 'ventas',

    columns: [
      {
        id: 'id',
        field: 'id',
        label: 'ID Venta',
        defaultWidth: 100,
        type: 'custom',
        alwaysVisible: true,
        editable: false,
        renderCell: (_id: string, row) => (
          <span className="font-mono text-xs text-gray-500">
            #{(row as Sale).saleNumber ?? '—'}
          </span>
        ),
      },
      {
        id: 'date',
        field: 'date',
        label: 'Fecha',
        defaultWidth: 130,
        type: 'text',
        editable: true,
      },
      {
        id: 'clientName',
        field: 'clientId',
        label: 'Cliente',
        defaultWidth: 180,
        type: 'custom',
        alwaysVisible: true,
        editable: true,
        renderCell: (clientId: string, row, helpers) => {
          if (helpers.isEditing(row.id, 'clientId')) {
            return (
              <select
                autoFocus
                value={helpers.inlineValue}
                onChange={(e) => {
                  helpers.setInlineValue(e.target.value);
                  helpers.commitEdit({ ...row, clientId: e.target.value });
                }}
                onBlur={() => helpers.onBlur(row)}
                onKeyDown={(e) => helpers.onKeyDown(e, row)}
                onClick={(e) => e.stopPropagation()}
                className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-gray-400 text-sm"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            );
          }

          const client = clients.find((c: Client) => c.id === clientId);
          return (
            <span
              className="inline-block rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-text font-medium text-gray-900"
              onClick={(e) => {
                e.stopPropagation();
                helpers.startEdit(row.id, 'clientId', clientId);
              }}
            >
              {client?.name ?? <span className="text-gray-300 italic">Cliente eliminado</span>}
            </span>
          );
        },
      },
      {
        id: 'productModel',
        field: 'productId',
        label: 'Modelo / IMEI',
        defaultWidth: 200,
        type: 'custom',
        alwaysVisible: true,
        editable: true,
        renderCell: (productId: string, row, helpers) => {
          if (helpers.isEditing(row.id, 'productId')) {
            return (
              <select
                autoFocus
                value={helpers.inlineValue}
                onChange={(e) => {
                  helpers.setInlineValue(e.target.value);
                  helpers.commitEdit({ ...row, productId: e.target.value });
                }}
                onBlur={() => helpers.onBlur(row)}
                onKeyDown={(e) => helpers.onKeyDown(e, row)}
                onClick={(e) => e.stopPropagation()}
                className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-gray-400 text-sm"
              >
                {inventory
                  .filter((product) => product.id === productId || product.status === 'DISPONIBLE')
                  .map((product) => (
                    <option key={product.id} value={product.id}>
                      {`${product.model}${product.capacity ? ` ${product.capacity}` : ''}${product.imei ? ` · ${product.imei}` : ''}`}
                    </option>
                  ))}
              </select>
            );
          }

          const product = inventory.find((p: Product) => p.id === productId);
          return product ? (
            <div
              className="inline-block rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-text"
              onClick={(e) => {
                e.stopPropagation();
                helpers.startEdit(row.id, 'productId', productId);
              }}
            >
              <div className="font-bold text-gray-900">{product.model} {product.capacity}</div>
              <div className="text-xs text-gray-400 mt-0.5">IMEI: {product.imei || '—'}</div>
            </div>
          ) : (
            <span
              className="inline-block rounded-2xl text-gray-400 italic hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-text"
              onClick={(e) => {
                e.stopPropagation();
                helpers.startEdit(row.id, 'productId', productId);
              }}
            >
              Producto eliminado
            </span>
          );
        },
      },
      {
        id: 'amount',
        field: 'amount',
        label: 'Monto',
        defaultWidth: 120,
        type: 'number',
        editable: true,
        formatDisplay: (v: number) => formatCurrency(v),
      },
      {
        id: 'paymentMethod',
        field: 'paymentMethod',
        label: 'Pago',
        defaultWidth: 150,
        type: 'badge',
        editable: true,
        enumOptions: ['TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'CANJE / PAGO', 'T. Crédito'],
        badgeMeta: PAYMENT_BADGE,
      },
      {
        id: 'status',
        field: 'status',
        label: 'Estado',
        defaultWidth: 130,
        type: 'badge',
        editable: true,
        enumOptions: ['COMPLETADA', 'PENDIENTE'],
        badgeMeta: STATUS_BADGE,
      },
    ],

    filters: [
      {
        id: 'paymentMethod',
        label: 'Método de pago',
        param: 'paymentMethod',
        defaultValue: '',
        options: [
          { value: '', label: 'Todos' },
          { value: 'TRANSFERENCIA', label: 'Transferencia' },
          { value: 'EFECTIVO', label: 'Efectivo' },
          { value: 'TARJETA', label: 'Tarjeta' },
          { value: 'CANJE / PAGO', label: 'Canje / Pago' },
          { value: 'T. Crédito', label: 'T. Crédito' },
        ],
      },
      {
        id: 'status',
        label: 'Estado',
        param: 'status',
        defaultValue: '',
        options: [
          { value: '', label: 'Todos' },
          { value: 'COMPLETADA', label: 'Completada' },
          { value: 'PENDIENTE', label: 'Pendiente' },
        ],
      },
    ],

    sortOptions: [
      { key: 'date', label: 'Fecha' },
      { key: 'amount', label: 'Monto' },
    ],

    categories: salesCategories,
    onCreateCategory: createSaleCategory,
    onRenameCategory: renameSaleCategory,
    onDeleteCategory: deleteSaleCategory,
    onReorderCategories: async (ids) => {
      await reorderSaleCategories(ids);
    },
    onBulkMoveCategory: async (ids, categoryId) => {
      await bulkMoveSaleCategory(ids, categoryId);
    },
    onBulkDelete: async (ids) => {
      await Promise.all(ids.map(id => deleteSale(id)));
      invalidateSalesCache();
    },

    editPanelTitle: 'Editar Venta',
    editPanelFields: [
      { label: 'Fecha', field: 'date', type: 'text', span: 2 },
      { label: 'Monto', field: 'amount', type: 'number' },
      {
        label: 'Estado', field: 'status', type: 'select',
        options: [
          { value: 'COMPLETADA', label: 'COMPLETADA' },
          { value: 'PENDIENTE', label: 'PENDIENTE' },
        ],
      },
      {
        label: 'Método de Pago', field: 'paymentMethod', type: 'select', span: 2,
        options: [
          { value: 'TRANSFERENCIA', label: 'TRANSFERENCIA' },
          { value: 'EFECTIVO', label: 'EFECTIVO' },
          { value: 'TARJETA', label: 'TARJETA' },
          { value: 'CANJE / PAGO', label: 'CANJE / PAGO' },
          { value: 'T. Crédito', label: 'T. Crédito' },
        ],
      },
    ],

    fetchPage: (params) => fetchSalesPage(user!, params),
    addRowFields: [
      {
        colId: 'clientName',
        required: true,
        selectOptions: [
          { value: '', label: 'Seleccionar cliente' },
          ...clients.map((client) => ({
            value: client.id,
            label: client.name,
          })),
        ],
      },
      {
        colId: 'productModel',
        required: true,
        selectOptions: [
          { value: '', label: 'Seleccionar equipo' },
          ...inventory
            .filter((product) => product.status === 'DISPONIBLE')
            .map((product) => ({
              value: product.id,
              label: `${product.model}${product.capacity ? ` ${product.capacity}` : ''}${product.imei ? ` · ${product.imei}` : ''}`,
            })),
        ],
      },
      { colId: 'date', placeholder: 'Fecha (ej. 2025-04-07)', required: true },
      { colId: 'amount', placeholder: 'Monto', required: true },
      {
        colId: 'paymentMethod',
        selectOptions: [
          { value: '', label: 'Seleccionar medio de pago' },
          { value: 'EFECTIVO', label: 'Efectivo' },
          { value: 'TRANSFERENCIA', label: 'Transferencia' },
          { value: 'TARJETA', label: 'Tarjeta' },
          { value: 'CANJE / PAGO', label: 'Canje / Pago' },
          { value: 'T. CrÃ©dito', label: 'T. CrÃ©dito' },
        ],
      },
      // status: engine auto-derives from ColDef enumOptions (COMPLETADA / PENDIENTE)
    ],
    buildNewItem: (formData, categoryId) => ({
      clientId: String(formData.clientId ?? '').trim(),
      productId: String(formData.productId ?? '').trim(),
      amount: Number(formData.amount) || 0,
      paymentMethod: formData.paymentMethod || 'EFECTIVO',
      status: formData.status || 'COMPLETADA',
      date: (formData.date ?? '').trim() || new Date().toISOString().slice(0, 10),
      categoryId: categoryId ?? null,
    }),
    onCreate: async (itemData) => {
      await addSale(itemData as Omit<Sale, 'id'>);
      invalidateSalesCache();
    },
    onUpdate: async (sale) => { await updateSaleViaApi(user!, sale); },
    onDelete: async (id) => { await deleteSaleViaApi(user!, id); invalidateSalesCache(); },
  }), [user, clients, inventory, salesCategories]);

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-shrink-0">
        <StatCard
          title="FACTURACIÓN TOTAL"
          value={formatCurrency(totalRevenue)}
          trend={`${sales.length} ventas`}
          icon={<TrendingUp size={16} className="text-emerald-500" />}
        />
        <StatCard
          title="TICKET PROMEDIO"
          value={formatCurrency(averageTicket)}
          trend={sales.length > 0 ? 'Datos reales' : 'Sin ventas'}
          icon={<BarChart size={16} className="text-gray-400" />}
        />
        <StatCard
          title="MARGEN BRUTO ESTIMADO"
          value={`${marginRate.toFixed(1)}%`}
          trend={formatCurrency(totalMargin)}
        />
      </div>

      {/* Table engine */}
      <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white min-h-0">
        <TableEngine config={config} user={user} />
      </div>
    </div>
  );
};
