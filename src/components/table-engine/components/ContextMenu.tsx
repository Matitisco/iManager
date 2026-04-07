import React from 'react';
import { motion } from 'motion/react';
import { X, Trash2, Edit2, Plus } from 'lucide-react';
import type { WithId, TableCategory } from '../types';

interface ContextMenuProps<TRow extends WithId> {
  x: number;
  y: number;
  item: TRow;
  isBulk: boolean;
  selectedCount: number;
  categories: TableCategory[];
  onClose: () => void;
  onAddRow?: () => void;
  onEdit: (item: TRow) => void;
  onDelete: (item: TRow) => void;
  onBulkDelete: () => void;
  onMoveToCategory?: (categoryId: string | null) => void;
  noun?: string;
  nounPlural?: string;
}

export function ContextMenu<TRow extends WithId>({
  x, y, item, isBulk, selectedCount, categories,
  onClose, onAddRow, onEdit, onDelete, onBulkDelete, onMoveToCategory,
  noun = 'ítem', nounPlural = 'ítems',
}: ContextMenuProps<TRow>) {
  const [moveOpen, setMoveOpen] = React.useState(false);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        style={{ position: 'fixed', top: y, left: x, zIndex: 50 }}
        className="w-52 bg-white rounded-xl shadow-xl border border-gray-100 text-sm py-1"
        onClick={e => e.stopPropagation()}
      >
        {!isBulk && (
          <>
            {onAddRow && (
              <button onClick={() => { onAddRow(); onClose(); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
                <Plus size={14} /> Agregar {noun}
              </button>
            )}
            <button onClick={() => { onEdit(item); onClose(); }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
              <Edit2 size={14} /> Editar {noun}
            </button>
            <div className="border-t border-gray-100" />
          </>
        )}
        {isBulk && (
          <div className="px-4 py-2 text-xs text-gray-400 font-semibold uppercase tracking-wider">
            {selectedCount} seleccionados
          </div>
        )}
        {categories.length > 0 && onMoveToCategory && (
          <>
            <div className="relative">
              <button onClick={() => setMoveOpen(!moveOpen)}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 font-medium text-gray-700">
                Mover a categoría →
              </button>
              {moveOpen && (
                <div className="absolute left-full top-0 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 ml-1 z-50">
                  <button onClick={() => { onMoveToCategory(null); onClose(); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-600">Sin categoría</button>
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => { onMoveToCategory(cat.id); onClose(); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 font-medium">{cat.name}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-gray-100" />
          </>
        )}
        <button onClick={() => { isBulk ? onBulkDelete() : onDelete(item); onClose(); }}
          className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 font-medium flex items-center gap-2">
          <Trash2 size={14} /> {isBulk ? `Eliminar ${selectedCount}` : `Eliminar ${noun}`}
        </button>
      </motion.div>
    </>
  );
}
