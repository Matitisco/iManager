import React from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import type { Variants } from 'motion/react';
import type { Product, InventoryCategory } from '../types';
import { ColumnDef } from './TableEngine/types';
import { batteryColor, extractMinBattery, formatBatteryDisplay } from '../utils/inventory';

export const inventoryTableMotion: { container: Variants; item: Variants } = {
  container: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  },
};

export type InventoryColumnId =
  | 'imei'
  | 'model'
  | 'battery'
  | 'price'
  | 'status'
  | 'condition'
  | 'capacity'
  | 'color'
  | 'grade'
  | 'cost';

export type InventoryAddingRow = {
  model: string;
  imei: string;
  price: string;
  batteryHealth: string;
  condition: Product['condition'];
  nameError: boolean;
};

export type InventoryTableMenuAction = {
  id: string;
  label: React.ReactNode;
  tone?: 'default' | 'danger';
  onClick: () => void | Promise<void>;
};

const STATUS_META: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  DISPONIBLE: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'DISPONIBLE' },
  VENDIDO: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'VENDIDO' },
  EN_REVISION: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'EN REVISIÓN' },
};

export function buildInventoryTableColumns(): ColumnDef<Product>[] {
  return [
    { id: 'imei', accessorKey: 'imei', header: 'IMEI', type: 'text', cell: ({ value }) => <span className="font-mono text-gray-500">{value as string}</span> },
    { id: 'model', accessorKey: 'model', header: 'Modelo', type: 'text', cell: ({ value }) => <span className="font-bold text-gray-900">{value as string}</span> },
    { id: 'battery', accessorKey: 'batteryHealth', header: 'Batería', type: 'text', cell: ({ value }) => {
        const val = value as string;
        if (!val || val === 'N/A' || val === '-') return <span className="text-gray-300">---</span>;
        const min = extractMinBattery(val);
        const { bg, text } = batteryColor(min);
        return (
          <div className="inline-flex items-center gap-2">
            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div style={{ width: `${min}%` }} className={`h-full ${bg}`} />
            </div>
            <span className={`font-bold ${text}`}>{formatBatteryDisplay(val)}</span>
          </div>
        );
      } },
    { id: 'price', accessorKey: 'price', header: 'Precio', type: 'currency', cell: ({ value }) => <span className="font-bold text-gray-900">${Number(value).toLocaleString('en-US')}</span> },
    { id: 'status', accessorKey: 'status', header: 'Disponibilidad', type: 'enum', options: ['DISPONIBLE', 'VENDIDO', 'EN_REVISION'], cell: ({ value }) => {
        const val = value as string;
        if (!val) return <span className="text-gray-300">---</span>;
        const meta = STATUS_META[val] || STATUS_META.EN_REVISION;
        return (
          <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wide ${meta.bg} ${meta.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
            {meta.label}
          </span>
        );
      } },
    { id: 'condition', accessorKey: 'condition', header: 'Condición', type: 'enum', options: ['NUEVO', 'USADO', 'PRE-OWNED'], cell: ({ value }) => value ? <span className="text-sm font-medium text-gray-700">{value as string}</span> : <span className="text-gray-300">---</span> },
    { id: 'capacity', accessorKey: 'capacity', header: 'Capacidad', type: 'text', cell: ({ value }) => value ? <span className="text-gray-700">{value as string}</span> : <span className="text-gray-300">---</span> },
    { id: 'color', accessorKey: 'color', header: 'Color', type: 'text', cell: ({ value }) => value ? <span className="text-gray-700">{value as string}</span> : <span className="text-gray-300">---</span> },
    { id: 'grade', accessorKey: 'grade', header: 'Grado', type: 'enum', options: ['A+', 'A', 'B', 'C', 'N/A'], cell: ({ value }) => value ? <span className="text-sm font-semibold text-gray-700">{value as string}</span> : <span className="text-gray-300">---</span> },
    { id: 'cost', accessorKey: 'cost', header: 'Costo', type: 'currency', cell: ({ value }) => value ? <span className="font-bold text-gray-900">${Number(value).toLocaleString('en-US')}</span> : <span className="text-gray-300">---</span> },
  ];
}

export interface InventoryAddRowProps {
  addingRow: InventoryAddingRow;
  addingRowDataRef: React.MutableRefObject<InventoryAddingRow | null>;
  addingRowTrRef: React.MutableRefObject<HTMLTableRowElement | null>;
  addModelInputRef: React.MutableRefObject<HTMLInputElement | null>;
  orderedColumns: InventoryColumnId[];
  activeCategoryId: string | null | 'all';
  onCancel: () => void;
  onCommit: (showErrorIfEmpty?: boolean) => Promise<void>;
  onChange: (next: InventoryAddingRow) => void;
}

export function renderInventoryAddRow({
  addingRow,
  addingRowDataRef,
  addingRowTrRef,
  addModelInputRef,
  orderedColumns,
  activeCategoryId,
  onCancel,
  onCommit,
  onChange,
}: InventoryAddRowProps) {
  return (
    <tr ref={addingRowTrRef} className="bg-blue-50/40 border-t-2 border-blue-200">
      <td className="px-3 py-3" />
      {orderedColumns.map((col) => {
        if (col === 'model') return (
          <td key={col} className="px-3 py-3">
            <input
              ref={addModelInputRef}
              value={addingRow.model}
              placeholder="Modelo..."
              maxLength={30}
              onChange={(e) => {
                const next = { ...addingRowDataRef.current!, model: e.target.value, nameError: false };
                addingRowDataRef.current = next;
                onChange(next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void onCommit(); }
                if (e.key === 'Escape') { e.preventDefault(); void onCommit(false); }
              }}
              onBlur={(e) => { if (!addingRowTrRef.current?.contains(e.relatedTarget as Node)) void onCommit(); }}
              className={`w-full outline-none border rounded-lg px-2 py-1 font-bold text-gray-900 text-sm bg-white focus:border-gray-400 ${addingRow.nameError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
            />
            {addingRow.nameError && <p className="text-[10px] text-red-500 mt-0.5 px-1">Requerido</p>}
          </td>
        );
        if (col === 'imei') return (
          <td key={col} className="px-3 py-3">
            <input
              value={addingRow.imei}
              placeholder="IMEI (opcional)"
              maxLength={20}
              onChange={(e) => {
                const next = { ...addingRowDataRef.current!, imei: e.target.value };
                addingRowDataRef.current = next;
                onChange(next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void onCommit(); }
                if (e.key === 'Escape') { e.preventDefault(); void onCommit(false); }
              }}
              onBlur={(e) => { if (!addingRowTrRef.current?.contains(e.relatedTarget as Node)) void onCommit(); }}
              className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 font-mono text-gray-500 text-sm bg-white focus:border-gray-400"
            />
          </td>
        );
        if (col === 'battery') return (
          <td key={col} className="px-3 py-3">
            <input
              value={addingRow.batteryHealth}
              placeholder="ej: 87%"
              maxLength={10}
              onChange={(e) => {
                const next = { ...addingRowDataRef.current!, batteryHealth: e.target.value };
                addingRowDataRef.current = next;
                onChange(next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void onCommit(); }
                if (e.key === 'Escape') { e.preventDefault(); void onCommit(false); }
              }}
              onBlur={(e) => { if (!addingRowTrRef.current?.contains(e.relatedTarget as Node)) void onCommit(); }}
              className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:border-gray-400"
            />
          </td>
        );
        if (col === 'price') return (
          <td key={col} className="px-3 py-3">
            <input
              type="number"
              value={addingRow.price}
              placeholder="0"
              onChange={(e) => {
                const next = { ...addingRowDataRef.current!, price: e.target.value };
                addingRowDataRef.current = next;
                onChange(next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void onCommit(); }
                if (e.key === 'Escape') { e.preventDefault(); void onCommit(false); }
              }}
              onBlur={(e) => { if (!addingRowTrRef.current?.contains(e.relatedTarget as Node)) void onCommit(); }}
              className="w-full outline-none border border-gray-200 rounded-lg px-2 py-1 font-bold text-gray-900 text-sm bg-white focus:border-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </td>
        );
        if (col === 'status') return (
          <td key={col} className="px-3 py-3">
            <select
              value={addingRow.condition}
              onChange={(e) => {
                const next = { ...addingRowDataRef.current!, condition: e.target.value as Product['condition'] };
                addingRowDataRef.current = next;
                onChange(next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void onCommit(); }
                if (e.key === 'Escape') { e.preventDefault(); void onCommit(false); }
              }}
              onBlur={(e) => { if (!addingRowTrRef.current?.contains(e.relatedTarget as Node)) void onCommit(); }}
              className="outline-none border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 bg-white focus:border-gray-400"
            >
              <option value="NUEVO">NUEVO</option>
              <option value="USADO">USADO</option>
              <option value="PRE-OWNED">PRE-OWNED</option>
            </select>
          </td>
        );
        return <td key={col} className="px-3 py-3 text-gray-300 text-sm">–</td>;
      })}
      <td className="px-3 py-3">
        <button
          onClick={onCancel}
          className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
          title="Cancelar (descartar)"
        >
          <X size={14} />
        </button>
      </td>
    </tr>
  );
}

export function buildInventoryTableMenuActions(args: {
  categories: InventoryCategory[];
  isBulk: boolean;
  selectedCount: number;
  item?: Product | null;
  onStartAddRow: () => void;
  onEditItem: (item: Product) => void;
  onDeleteItem: (item: Product) => void;
  onDeleteBulk: () => void;
  onMoveItems: (ids: string[], categoryId: string | null) => void;
  selectedIds: string[];
}) {
  const { categories, isBulk, selectedCount, item, onStartAddRow, onEditItem, onDeleteItem, onDeleteBulk, onMoveItems, selectedIds } = args;
  const actions: InventoryTableMenuAction[] = [];

  actions.push({ id: 'add-item', label: <span className="flex items-center gap-2"><Plus size={14} /> Agregar ítem</span>, onClick: onStartAddRow });

  if (isBulk) {
    actions.push({
      id: 'move-none',
      label: 'Mover a sin categoría',
      onClick: () => onMoveItems(selectedIds, null),
    });
    categories.forEach((cat) => {
      actions.push({
        id: `move-${cat.id}`,
        label: cat.name,
        onClick: () => onMoveItems(selectedIds, cat.id),
      });
    });
    actions.push({
      id: 'delete-bulk',
      label: <span className="flex items-center gap-2"><Trash2 size={14} /> Eliminar {selectedCount}</span>,
      tone: 'danger',
      onClick: onDeleteBulk,
    });
    return actions;
  }

  if (item) {
    actions.push({ id: 'edit', label: <span className="flex items-center gap-2"><Edit2 size={14} /> Editar</span>, onClick: () => onEditItem(item) });
    actions.push({
      id: 'move-none',
      label: 'Mover a sin categoría',
      onClick: () => onMoveItems([item.id], null),
    });
    categories.forEach((cat) => {
      actions.push({
        id: `move-${cat.id}`,
        label: cat.name,
        onClick: () => onMoveItems([item.id], cat.id),
      });
    });
    actions.push({
      id: 'delete',
      label: <span className="flex items-center gap-2"><Trash2 size={14} /> Eliminar</span>,
      tone: 'danger',
      onClick: () => onDeleteItem(item),
    });
  }

  return actions;
}
