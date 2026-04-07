import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { TableEngine } from '../components/table-engine';
import type { TableEngineConfig, TablePageParams, TableFilterParams, CellHelpers } from '../components/table-engine';
import type { Product } from '../types';
import { ImportInventoryModal } from '../components/ImportInventoryModal';
import {
  fetchInventoryPage,
  fetchInventoryFilteredIds,
  createBackendInventoryItem,
  updateBackendInventoryItem,
  deleteBackendInventoryItem,
  bulkMoveCategoryApi,
  reorderCategoriesApi,
} from '../services/inventory-api';
import { extractMinBattery, formatBatteryDisplay, batteryColor } from '../utils/inventory';
import { motion } from 'motion/react';

// ── Badge metadata ────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  DISPONIBLE:  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'DISPONIBLE' },
  VENDIDO:     { bg: 'bg-gray-100',    text: 'text-gray-500',    dot: 'bg-gray-400',    label: 'VENDIDO' },
  EN_REVISION: { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'EN REVISIÓN' },
};

const CONDITION_META: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  NUEVO:     { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-400',   label: 'NUEVO' },
  USADO:     { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400',   label: 'USADO' },
  'PRE-OWNED':{ bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400', label: 'PRE-OWNED' },
};

const GRADE_META: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  'A+': { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'A+' },
  'A':  { bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-400',   label: 'A' },
  'B':  { bg: 'bg-yellow-100',  text: 'text-yellow-700',  dot: 'bg-yellow-400',  label: 'B' },
  'C':  { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-400',  label: 'C' },
  'N/A':{ bg: 'bg-gray-100',   text: 'text-gray-500',    dot: 'bg-gray-400',    label: 'N/A' },
};

// ── Battery cell ──────────────────────────────────────────────────────────────
function BatteryCell({ value, row, helpers }: { value: string; row: Product; helpers: CellHelpers<Product> }) {
  if (helpers.isEditing(row.id, 'batteryHealth')) {
    return (
      <input
        autoFocus
        value={helpers.inlineValue}
        placeholder="ej: 87%"
        maxLength={30}
        onChange={e => helpers.setInlineValue(e.target.value)}
        onBlur={() => helpers.onBlur(row)}
        onKeyDown={e => helpers.onKeyDown(e, row)}
        onClick={e => e.stopPropagation()}
        className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 bg-white focus:border-gray-400 font-bold text-sm"
      />
    );
  }

  if (!value) {
    return (
      <div
        className="inline-block rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-text text-gray-300"
        onClick={e => { e.stopPropagation(); helpers.startEdit(row.id, 'batteryHealth', ''); }}
      >
        ---
      </div>
    );
  }

  const min = extractMinBattery(value);
  const colorMeta = batteryColor(min);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-2xl hover:bg-gray-200/70 transition-colors px-2 py-1.5 -mx-2 -my-1.5 cursor-text"
      onClick={e => { e.stopPropagation(); helpers.startEdit(row.id, 'batteryHealth', value); }}
    >
      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${min}%` }}
          className={`h-full ${colorMeta.bg}`}
        />
      </div>
      <span className={`font-bold ${colorMeta.text}`}>
        {formatBatteryDisplay(value)}
      </span>
    </div>
  );
}

/**
 * Adapts TablePageParams (generic engine format) → InventoryPageParams
 * The backend expects individual filter params, not a generic filters record.
 */
function adaptParams(params: TablePageParams): Parameters<typeof fetchInventoryPage>[1] {
  return {
    skip: params.skip,
    take: params.take,
    categoryId: params.categoryId ?? undefined,
    sortKey: params.sortKey,
    sortDir: params.sortDir,
    condition: params.filters?.condition || undefined,
    status: params.filters?.status || undefined,
    capacity: params.filters?.capacity || undefined,
    model: params.filters?.model || undefined,
    grade: params.filters?.grade || undefined,
    battery: params.filters?.battery || undefined,
  };
}

function adaptFilterParams(params: TableFilterParams): Parameters<typeof fetchInventoryFilteredIds>[1] {
  return {
    categoryId: params.categoryId ?? undefined,
    condition: params.filters?.condition || undefined,
    status: params.filters?.status || undefined,
    capacity: params.filters?.capacity || undefined,
    model: params.filters?.model || undefined,
    grade: params.filters?.grade || undefined,
    battery: params.filters?.battery || undefined,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export const Inventory: React.FC = () => {
  const {
    user,
    inventoryCategories,
    createCategory,
    renameCategory,
    deleteCategory,
    updateProduct,
    deleteProduct,
    addProduct,
    reloadInventory,
  } = useAppContext();

  const config = useMemo((): TableEngineConfig<Product> => ({
    title: 'Inventario',
    storageKey: 'inventory',
    exportSheetName: 'Inventario',
    noun: 'equipo',
    nounPlural: 'equipos',

    // ── Columns ───────────────────────────────────────────────────────────────
    columns: [
      {
        id: 'imei',
        field: 'imei',
        label: 'IMEI',
        defaultWidth: 180,
        type: 'text',
        editable: true,
        tdClassName: 'font-mono text-xs',
      },
      {
        id: 'model',
        field: 'model',
        label: 'Modelo',
        defaultWidth: 260,
        type: 'text',
        editable: true,
        alwaysVisible: true,
      },
      {
        id: 'condition',
        field: 'condition',
        label: 'Condición',
        defaultWidth: 120,
        type: 'badge',
        editable: true,
        enumOptions: ['NUEVO', 'USADO', 'PRE-OWNED'],
        badgeMeta: CONDITION_META,
      },
      {
        id: 'capacity',
        field: 'capacity',
        label: 'Capacidad',
        defaultWidth: 110,
        type: 'text',
        editable: true,
      },
      {
        id: 'color',
        field: 'color',
        label: 'Color',
        defaultWidth: 110,
        type: 'text',
        editable: true,
      },
      {
        id: 'grade',
        field: 'grade',
        label: 'Grado',
        defaultWidth: 90,
        type: 'badge',
        editable: true,
        enumOptions: ['A+', 'A', 'B', 'C', 'N/A'],
        badgeMeta: GRADE_META,
      },
      {
        id: 'battery',
        field: 'batteryHealth',
        label: 'Batería',
        defaultWidth: 140,
        type: 'custom',
        editable: true,
        renderCell: (value: string, _row, helpers) => <BatteryCell value={value} row={_row} helpers={helpers} />,
      },
      {
        id: 'cost',
        field: 'cost',
        label: 'Costo',
        defaultWidth: 110,
        type: 'number',
        editable: true,
        formatDisplay: (v: number) => v != null ? `$${Number(v).toLocaleString('en-US')}` : null!,
      },
      {
        id: 'price',
        field: 'price',
        label: 'Precio',
        defaultWidth: 120,
        type: 'number',
        editable: true,
        alwaysVisible: true,
        formatDisplay: (v: number) => v != null ? `$${Number(v).toLocaleString('en-US')}` : null!,
      },
      {
        id: 'status',
        field: 'status',
        label: 'Disponibilidad',
        defaultWidth: 150,
        type: 'badge',
        editable: true,
        alwaysVisible: true,
        enumOptions: ['DISPONIBLE', 'VENDIDO', 'EN_REVISION'],
        badgeMeta: STATUS_META,
      },
    ],

    // ── Filters ───────────────────────────────────────────────────────────────
    filters: [
      {
        id: 'status',
        label: 'Disponibilidad',
        param: 'status',
        defaultValue: '',
        options: [
          { value: '', label: 'Todos' },
          { value: 'DISPONIBLE', label: 'Disponible' },
          { value: 'VENDIDO', label: 'Vendido' },
          { value: 'EN_REVISION', label: 'En revisión' },
        ],
      },
      {
        id: 'condition',
        label: 'Condición',
        param: 'condition',
        defaultValue: '',
        options: [
          { value: '', label: 'Todos' },
          { value: 'NUEVO', label: 'Nuevo' },
          { value: 'USADO', label: 'Usado' },
          { value: 'PRE-OWNED', label: 'Pre-owned' },
        ],
      },
      {
        id: 'grade',
        label: 'Grado',
        param: 'grade',
        defaultValue: '',
        options: [
          { value: '', label: 'Todos' },
          { value: 'A+', label: 'A+' },
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
          { value: 'C', label: 'C' },
          { value: 'N/A', label: 'N/A' },
        ],
      },
      {
        id: 'battery',
        label: 'Batería',
        param: 'battery',
        defaultValue: '',
        options: [
          { value: '', label: 'Todas' },
          { value: '90', label: '≥ 90%' },
          { value: '80', label: '≥ 80%' },
          { value: '70', label: '≥ 70%' },
        ],
      },
    ],

    // ── Sort ──────────────────────────────────────────────────────────────────
    sortOptions: [
      { key: 'price', label: 'Precio' },
      { key: 'cost', label: 'Costo' },
      { key: 'model', label: 'Modelo' },
      { key: 'batteryHealth', label: 'Batería' },
    ],

    // ── Categories ────────────────────────────────────────────────────────────
    categories: inventoryCategories,
    onCreateCategory: createCategory,
    onRenameCategory: renameCategory,
    onDeleteCategory: deleteCategory,
    onReorderCategories: async (ids) => {
      if (!user) return;
      await reorderCategoriesApi(user, ids);
    },
    onBulkMoveCategory: async (ids, categoryId) => {
      if (!user) return;
      await bulkMoveCategoryApi(user, ids, categoryId);
    },

    // ── Data ──────────────────────────────────────────────────────────────────
    fetchPage: async (params) => {
      if (!user) return { items: [], total: 0 };
      return fetchInventoryPage(user, adaptParams(params));
    },
    fetchFilteredIds: async (params) => {
      if (!user) return [];
      return fetchInventoryFilteredIds(user, adaptFilterParams(params));
    },

    // ── CRUD ──────────────────────────────────────────────────────────────────
    onCreate: async (data) => {
      if (!user) throw new Error('No autenticado');
      const product = await createBackendInventoryItem(user, data as Omit<Product, 'id'>);
      return product;
    },
    onUpdate: async (product) => {
      await updateProduct(product);
    },
    onDelete: async (id) => {
      await deleteProduct(id);
    },
    onBulkDelete: async (ids) => {
      if (!user) throw new Error('No autenticado');
      await Promise.all(ids.map(id => deleteBackendInventoryItem(user, id)));
    },

    // ── Add row inline ────────────────────────────────────────────────────────
    addRowFields: [
      { colId: 'model', placeholder: 'Modelo (ej. iPhone 15 Pro)', required: true },
      { colId: 'imei', placeholder: 'IMEI' },
      { colId: 'price', placeholder: 'Precio' },
    ],
    buildNewItem: (formData, categoryId) => ({
      model: formData.model ?? '',
      imei: (formData.imei ?? '').trim() || `MAN-${Date.now()}`,
      price: Number(formData.price) || 0,
      cost: Number(formData.cost) || 0,
      capacity: formData.capacity ?? '',
      color: formData.color ?? '',
      batteryHealth: formData.batteryHealth ?? '',
      condition: formData.condition ?? 'NUEVO',
      grade: formData.grade ?? 'N/A',
      status: formData.status ?? 'DISPONIBLE',
      categoryId: categoryId ?? null,
    }),

    // ── Edit panel ────────────────────────────────────────────────────────────
    editPanelTitle: 'Editar equipo',
    editPanelFields: [
      { label: 'Modelo',    field: 'model',         type: 'text',   span: 2 },
      { label: 'IMEI',      field: 'imei',          type: 'text',   span: 2, mono: true },
      { label: 'Precio',    field: 'price',         type: 'number' },
      { label: 'Costo',     field: 'cost',          type: 'number' },
      { label: 'Capacidad', field: 'capacity',      type: 'text' },
      { label: 'Color',     field: 'color',         type: 'text' },
      { label: 'Batería',   field: 'batteryHealth', type: 'text' },
      {
        label: 'Condición', field: 'condition', type: 'select',
        options: [
          { value: 'NUEVO', label: 'NUEVO' },
          { value: 'USADO', label: 'USADO' },
          { value: 'PRE-OWNED', label: 'PRE-OWNED' },
        ],
      },
      {
        label: 'Grado', field: 'grade', type: 'select',
        options: [
          { value: 'A+', label: 'A+' },
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
          { value: 'C', label: 'C' },
          { value: 'N/A', label: 'N/A' },
        ],
      },
      {
        label: 'Estado', field: 'status', type: 'select', span: 2,
        options: [
          { value: 'DISPONIBLE', label: 'DISPONIBLE' },
          { value: 'VENDIDO', label: 'VENDIDO' },
          { value: 'EN_REVISION', label: 'EN REVISIÓN' },
        ],
      },
    ],

    // ── Import ────────────────────────────────────────────────────────────────
    ImportModal: ImportInventoryModal,
    showImport: true,
  }), [
    user,
    inventoryCategories,
    createCategory,
    renameCategory,
    deleteCategory,
    updateProduct,
    deleteProduct,
    addProduct,
  ]);

  return (
    <div className="flex flex-col h-full">
      <TableEngine config={config} user={user} />
    </div>
  );
};
