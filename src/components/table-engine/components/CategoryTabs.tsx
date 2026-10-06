import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Plus } from 'lucide-react';
import type { TableCategory } from '../types';

interface CategoryTabsProps {
  categories: TableCategory[];
  activeCategoryId: string | null | 'all';
  setActiveCategoryId: (id: string | null | 'all') => void;
  draggingCat: { id: string; label: string } | null;
  dropTargetId: string | null;
  draggingItems: boolean;
  itemDropTarget: string | null;
  justDraggedRef: React.MutableRefObject<boolean>;
  catTabsContainerRef: React.RefObject<HTMLDivElement>;
  startCatDrag: (e: React.PointerEvent, catId: string, label: string) => void;
  editingCategoryId: string | null;
  editingCategoryName: string;
  setEditingCategoryId: (id: string | null) => void;
  setEditingCategoryName: (name: string) => void;
  renameDoneRef: React.MutableRefObject<boolean>;
  onRenameCategory?: (id: string, name: string) => Promise<void>;
  onDeleteCategory?: (id: string, name: string) => void;
  onCreateCategory?: (name: string) => Promise<TableCategory>;
}

export function CategoryTabs({
  categories, activeCategoryId, setActiveCategoryId,
  draggingCat, dropTargetId, draggingItems, itemDropTarget,
  justDraggedRef, catTabsContainerRef, startCatDrag,
  editingCategoryId, editingCategoryName, setEditingCategoryId, setEditingCategoryName,
  renameDoneRef, onRenameCategory, onDeleteCategory, onCreateCategory,
}: CategoryTabsProps) {
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  return (
    <div ref={catTabsContainerRef} className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-100 overflow-x-auto select-none">
      {(['all', ...categories.map(c => c.id)] as const).map(catId => {
        const label = catId === 'all' ? 'Todas' : categories.find(c => c.id === catId)?.name ?? '';
        const active = activeCategoryId === catId;
        return (
          <div key={catId} data-cat-id={catId !== 'all' ? catId : undefined}
            className="relative group flex-shrink-0"
            onPointerDown={catId !== 'all' ? (e) => startCatDrag(e, catId, label) : undefined}>
            {dropTargetId === catId && draggingCat?.id !== catId && (
              <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-gray-900 rounded-full z-10" />
            )}
            {catId !== 'all' && editingCategoryId === catId ? (
              <input autoFocus value={editingCategoryName}
                onChange={e => setEditingCategoryName(e.target.value)}
                onBlur={async () => {
                  if (renameDoneRef.current) { renameDoneRef.current = false; return; }
                  const trimmed = editingCategoryName.trim();
                  if (trimmed && trimmed !== label && onRenameCategory) {
                    try { await onRenameCategory(catId, trimmed); } catch {}
                  }
                  setEditingCategoryId(null);
                }}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); renameDoneRef.current = true;
                    const trimmed = editingCategoryName.trim();
                    if (trimmed && trimmed !== label && onRenameCategory) {
                      try { await onRenameCategory(catId, trimmed); } catch { renameDoneRef.current = false; return; }
                    }
                    setEditingCategoryId(null);
                  } else if (e.key === 'Escape') { renameDoneRef.current = true; setEditingCategoryId(null); }
                }}
                className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 focus:outline-none focus:ring-2 focus:ring-black/10 w-28 ${active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-700'}`}
              />
            ) : (
              <button
                onClick={() => { if (!justDraggedRef.current) setActiveCategoryId(catId); }}
                onDoubleClick={() => { if (catId !== 'all') { renameDoneRef.current = false; setEditingCategoryId(catId); setEditingCategoryName(label); } }}
                className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 ${
                  draggingCat?.id === catId ? 'opacity-40 border-dashed border-gray-300 text-gray-400'
                    : draggingItems && itemDropTarget === catId ? 'border-gray-900 text-gray-900 bg-gray-100 scale-110 shadow-sm'
                    : draggingItems && catId !== 'all' ? 'border-transparent text-gray-500 hover:text-gray-600 opacity-70'
                    : active ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {label}
              </button>
            )}
            {catId !== 'all' && editingCategoryId !== catId && onDeleteCategory && (
              <button
                type="button"
                aria-label={`Eliminar categoría ${label}`}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onDeleteCategory(catId, label); }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 hover:bg-red-200 text-gray-500 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}
      {onCreateCategory && (
        showNewCategory ? (
          <form onSubmit={async e => {
            e.preventDefault();
            if (!newCategoryName.trim() || creatingCategory) return;
            setCreatingCategory(true);
            try {
              const cat = await onCreateCategory(newCategoryName.trim());
              setActiveCategoryId(cat.id);
              setNewCategoryName('');
              setShowNewCategory(false);
            } finally { setCreatingCategory(false); }
          }} className="flex items-center gap-1 ml-1">
            <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && (setShowNewCategory(false), setNewCategoryName(''))}
              placeholder="Nombre..."
              className="text-sm px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 w-32" />
            <button type="submit" disabled={creatingCategory} className="text-xs px-2 py-1 bg-gray-900 text-white rounded-lg disabled:opacity-50">OK</button>
            <button type="button" onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">✕</button>
          </form>
        ) : (
          <button onClick={() => setShowNewCategory(true)}
            className="flex-shrink-0 ml-1 px-2 py-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium">
            <Plus size={13} /> Nueva
          </button>
        )
      )}
    </div>
  );
}
