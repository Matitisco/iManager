import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Trash2 } from 'lucide-react';
import type { WithId, TableCategory } from '../types';

interface BulkActionsBarProps<TRow extends WithId> {
  selectedIds: Set<string>;
  total: number;
  categories: TableCategory[];
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkMove?: (categoryId: string) => void;
  noun?: string;
  nounPlural?: string;
}

export function BulkActionsBar<TRow extends WithId>({
  selectedIds, total, categories, onClearSelection, onBulkDelete, onBulkMove, noun = 'ítem', nounPlural = 'ítems',
}: BulkActionsBarProps<TRow>) {
  const count = selectedIds.size;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-2xl shadow-2xl border border-gray-700 flex items-center gap-1 p-1.5"
        >
          <button onClick={onClearSelection}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
          <div className="px-3 py-1.5 text-sm font-semibold text-gray-200">
            {count} {count === 1 ? noun : nounPlural} seleccionado{count === 1 ? '' : 's'}
          </div>
          <div className="h-5 w-px bg-gray-700 mx-1" />
          {categories.length > 0 && onBulkMove && (
            <div className="relative group">
              <button className="px-3 py-1.5 text-sm font-semibold text-gray-200 hover:text-white hover:bg-gray-700 rounded-xl transition-colors">
                Mover a...
              </button>
              <div className="absolute bottom-full mb-2 left-0 w-44 bg-white text-gray-900 rounded-xl shadow-xl border border-gray-100 py-1 hidden group-hover:block z-50">
                <button onClick={() => onBulkMove('')}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 font-medium">Sin categoría</button>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => onBulkMove(cat.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 font-medium">{cat.name}</button>
                ))}
              </div>
            </div>
          )}
          <button onClick={onBulkDelete}
            data-testid="table-bulk-delete"
            className="px-3 py-1.5 text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-xl transition-colors flex items-center gap-1.5">
            <Trash2 size={14} /> Eliminar
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
