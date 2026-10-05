import React, { useMemo } from 'react';
import { Users, UserCheck, Wallet, Ticket } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { TableEngine } from '../components/table-engine';
import { duplicateUniqueValue } from '../components/table-engine/rowClipboard';
import type { TableEngineConfig } from '../components/table-engine';
import type { Client } from '../types';
import { formatCurrency } from '../lib/utils';
import {
  fetchClientsPage,
  updateClientViaApi,
  deleteClientViaApi,
  invalidateClientsCache,
  updateClientCategoryInCache,
} from '../services/clients-table-api';
import { importBackendClients } from '../services/clients-import-api';

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({
  title,
  value,
  trend,
  trendDown = false,
  icon,
}: {
  title: string;
  value: string;
  trend: string;
  trendDown?: boolean;
  icon?: React.ReactNode;
}) => (
  <motion.div
    whileHover={{ y: -4, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
    className="bg-white p-5 rounded-2xl border border-gray-200 h-full transition-shadow cursor-default"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-2">{icon}</div>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trendDown ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
        {trend}
      </span>
    </div>
    <div className="text-sm text-gray-500 font-medium mb-1">{title}</div>
    <div className="text-3xl font-black text-gray-900">{value}</div>
  </motion.div>
);

// ── Main component ─────────────────────────────────────────────────────────────
interface ClientsProps {
  searchTerm?: string;
}

export const Clients: React.FC<ClientsProps> = ({ searchTerm = '' }) => {
  const {
    user, clients, sales, addClient,
    clientCategories, createClientCategory, renameClientCategory, deleteClientCategory,
    bulkMoveClientCategory, reorderClientCategories,
    customColumns, addCustomColumn, removeCustomColumn,
  } = useAppContext();
  const clientCustomColumns = useMemo(
    () => customColumns.filter((column) => column.entity === 'clients'),
    [customColumns],
  );

  // Stats computed from the cached full list in AppContext
  const totalClients = clients.length;
  const clientsWithActivity = clients.filter(
    c => c.totalSpent > 0 || c.lastPurchaseDate !== 'N/A'
  ).length;
  const totalPendingBalance = clients.reduce((sum, c) => sum + c.pendingBalance, 0);
  const averageTicket =
    sales.length > 0 ? sales.reduce((sum, s) => sum + s.amount, 0) / sales.length : 0;

  const config = useMemo((): TableEngineConfig<Client> => ({
    title: 'Clientes',
    storageKey: 'clients',
    exportSheetName: 'Clientes',
    noun: 'cliente',
    nounPlural: 'clientes',

    categories: clientCategories,
    onCreateCategory: createClientCategory,
    onRenameCategory: renameClientCategory,
    onDeleteCategory: deleteClientCategory,
    onReorderCategories: reorderClientCategories,
    onBulkMoveCategory: async (ids, categoryId) => {
      await bulkMoveClientCategory(ids, categoryId);
      updateClientCategoryInCache(ids, categoryId);
    },

    columns: [
      {
        id: 'name',
        field: 'name',
        label: 'Nombre',
        defaultWidth: 200,
        type: 'text',
        alwaysVisible: true,
        editable: true,
      },
      {
        id: 'dni',
        field: 'dni',
        label: 'DNI',
        defaultWidth: 130,
        type: 'text',
        editable: true,
        tdClassName: 'text-gray-500',
        onDuplicateValue: (value, index) => duplicateUniqueValue(value, index, 50),
      },
      {
        id: 'email',
        field: 'email',
        label: 'Email',
        defaultWidth: 220,
        type: 'text',
        editable: true,
        tdClassName: 'text-gray-500',
      },
      {
        id: 'phone',
        field: 'phone',
        label: 'Teléfono',
        defaultWidth: 140,
        type: 'text',
        editable: true,
        tdClassName: 'text-gray-500',
      },
      {
        id: 'lastPurchaseDate',
        field: 'lastPurchaseDate',
        label: 'Última Compra',
        defaultWidth: 150,
        type: 'custom',
        editable: false,
        renderCell: (value: string) => (
          <span className="text-gray-500">{value && value !== 'N/A' ? value : '—'}</span>
        ),
      },
      {
        id: 'totalSpent',
        field: 'totalSpent',
        label: 'Total Gastado',
        defaultWidth: 140,
        type: 'custom',
        editable: false,
        renderCell: (value: number) => (
          <span className="font-bold text-gray-900">{formatCurrency(value)}</span>
        ),
      },
      {
        id: 'pendingBalance',
        field: 'pendingBalance',
        label: 'Saldo Pendiente',
        defaultWidth: 150,
        type: 'custom',
        editable: false,
        renderCell: (value: number) => (
          <span className={value > 0 ? 'font-bold text-red-600' : 'font-bold text-gray-900'}>
            {formatCurrency(value)}
          </span>
        ),
      },
    ],

    filters: [
      {
        id: 'status',
        label: 'Estado',
        param: 'status',
        defaultValue: '',
        options: [
          { value: '', label: 'Todos' },
          { value: 'active', label: 'Activos' },
          { value: 'inactive', label: 'Inactivos' },
        ],
      },
      {
        id: 'balance',
        label: 'Saldo Pendiente',
        param: 'balance',
        defaultValue: '',
        options: [
          { value: '', label: 'Todos' },
          { value: 'debt', label: 'Con Deuda' },
          { value: 'no_debt', label: 'Sin Deuda' },
        ],
      },
    ],

    sortOptions: [
      { key: 'name', label: 'Nombre' },
      { key: 'totalSpent', label: 'Total Gastado' },
      { key: 'pendingBalance', label: 'Saldo Pendiente' },
      { key: 'lastPurchaseDate', label: 'Última Compra' },
    ],

    editPanelTitle: 'Editar Cliente',
    editPanelFields: [
      { label: 'Nombre', field: 'name', type: 'text', span: 2 },
      { label: 'DNI', field: 'dni', type: 'text' },
      { label: 'Teléfono', field: 'phone', type: 'text' },
      { label: 'Email', field: 'email', type: 'text', span: 2 },
      { label: 'Saldo Pendiente', field: 'pendingBalance', type: 'number' },
    ],

    addRowFields: [
      { colId: 'name', placeholder: 'Nombre', required: true },
      { colId: 'dni', placeholder: 'DNI' },
      { colId: 'phone', placeholder: 'Teléfono' },
      { colId: 'email', placeholder: 'Email' },
    ],
    buildNewItem: (formData, categoryId) => ({
      customFields: (() => {
        const entries = Object.entries(formData)
          .filter(([key, value]) => key.startsWith('dynamic:') && value !== '' && value != null)
          .map(([key, value]) => [
            key.replace('dynamic:', ''),
            clientCustomColumns.find((column) => column.id === key.replace('dynamic:', ''))?.type === 'number'
              ? Number(value)
              : value,
          ]);

        return entries.length > 0 ? Object.fromEntries(entries) : undefined;
      })(),
      name: formData.name ?? '',
      dni: formData.dni ?? '',
      email: formData.email ?? '',
      phone: formData.phone ?? '',
      lastPurchaseDate: 'N/A',
      totalSpent: 0,
      pendingBalance: 0,
      categoryId: categoryId ?? null,
    }),
    onCreate: async (data) => {
      await addClient(data as Omit<Client, 'id'>);
      invalidateClientsCache();
    },

    fetchPage: (params) => fetchClientsPage(user!, params),

    onUpdate: async (client) => {
      await updateClientViaApi(user!, client);
    },
    onDelete: async (id) => {
      await deleteClientViaApi(user!, id);
    },
    onBulkDelete: async (ids) => {
      await Promise.all(ids.map(id => deleteClientViaApi(user!, id)));
    },

    importConfig: {
      title: 'Importar clientes',
      fields: [
        { key: 'name',  label: 'Nombre',    required: true },
        { key: 'dni',   label: 'DNI',       required: false },
        { key: 'email', label: 'Email',     required: false },
        { key: 'phone', label: 'Teléfono',  required: false },
      ],
      mapHints: {
        nombre: 'name', cliente: 'name',
        documento: 'dni', cedula: 'dni',
        correo: 'email', mail: 'email',
        telefono: 'phone', celular: 'phone', tel: 'phone',
      },
      onImport: async (rows) => importBackendClients(user!, rows),
    },
    customColumnActions: {
      onCreate: async ({ label, type, options }) => {
        const id = await addCustomColumn({ label, type, options, entity: 'clients' });
        if (!id) {
          throw new Error('No se pudo crear la columna.');
        }
      },
      onDelete: async (colId) => {
        if (!colId.startsWith('dynamic:')) return;
        await removeCustomColumn(colId.replace('dynamic:', ''));
      },
      canDelete: (colId) => colId.startsWith('dynamic:'),
    },
    dynamicColumns: {
      columns: clientCustomColumns,
      defaultWidth: 160,
      getValue: (row, columnId) => row.customFields?.[columnId] ?? '',
      setValue: (row, columnId, value) => ({
        ...row,
        customFields: {
          ...(row.customFields ?? {}),
          [columnId]: clientCustomColumns.find((column) => column.id === columnId)?.type === 'number'
            ? (value === '' || value == null ? '' : Number(value))
            : value,
        },
      }),
    },
  }), [user, addClient, clientCustomColumns, addCustomColumn, removeCustomColumn]);

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <StatCard
          title="Total Clientes"
          value={String(totalClients)}
          trend="Datos reales"
          icon={<Users size={18} className="text-gray-400" />}
        />
        <StatCard
          title="Clientes con actividad"
          value={String(clientsWithActivity)}
          trend={sales.length > 0 ? 'Basado en ventas' : 'Sin ventas'}
          icon={<UserCheck size={18} className="text-gray-400" />}
        />
        <StatCard
          title="Saldo Pendiente Total"
          value={formatCurrency(totalPendingBalance)}
          trend={totalPendingBalance > 0 ? 'Deuda real' : 'Sin deuda'}
          trendDown={totalPendingBalance > 0}
          icon={<Wallet size={18} className="text-gray-400" />}
        />
        <StatCard
          title="Ticket Promedio"
          value={formatCurrency(averageTicket)}
          trend={sales.length > 0 ? 'Datos reales' : 'Sin ventas'}
          icon={<Ticket size={18} className="text-gray-400" />}
        />
      </div>

      {/* Table engine */}
      <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white min-h-0">
        <TableEngine config={config} user={user} searchTerm={searchTerm} />
      </div>
    </div>
  );
};
