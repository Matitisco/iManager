import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';

interface ActionMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

export function ActionMenu({ onEdit, onDelete }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={e => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1 text-gray-400 hover:text-gray-900 transition-colors">
        <MoreVertical size={16} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden text-sm">
              <button onClick={() => { onEdit(); setIsOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 font-medium text-gray-700 flex items-center gap-2">
                <Edit2 size={14} /> Editar
              </button>
              <div className="border-t border-gray-100" />
              <button onClick={() => { onDelete(); setIsOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 font-medium flex items-center gap-2">
                <Trash2 size={14} /> Eliminar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
