import { useState, useRef, useEffect } from 'react';
import type { TableCategory } from '../types';

export function useItemDrag(
  categories: TableCategory[],
  selectedIdsRef: React.MutableRefObject<Set<string>>,
  catTabsContainerRef: React.RefObject<HTMLDivElement>,
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  onPendingMove: (categoryId: string, categoryName: string, count: number) => void
) {
  const [draggingItems, setDraggingItems] = useState(false);
  const [itemDragPos, setItemDragPos] = useState({ x: 0, y: 0 });
  const [itemDropTarget, setItemDropTarget] = useState<string | null>(null);

  const draggingItemsRef = useRef(false);
  const itemDropTargetRef = useRef<string | null>(null);
  const itemDragStartRef = useRef<{ x: number; y: number; itemId: string } | null>(null);
  const justItemDraggedRef = useRef(false);
  const categoriesRef = useRef(categories);

  useEffect(() => { categoriesRef.current = categories; }, [categories]);

  useEffect(() => {
    if (draggingItems) { document.body.style.cursor = 'none'; document.body.style.userSelect = 'none'; }
    else { document.body.style.cursor = ''; document.body.style.userSelect = ''; }
    return () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; };
  }, [draggingItems]);

  useEffect(() => {
    const DRAG_THRESHOLD = 5;
    const onMove = (e: PointerEvent) => {
      if (itemDragStartRef.current && !draggingItemsRef.current) {
        const dx = e.clientX - itemDragStartRef.current.x;
        const dy = e.clientY - itemDragStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          if (!selectedIdsRef.current.has(itemDragStartRef.current.itemId)) {
            const newIds = new Set(selectedIdsRef.current);
            newIds.add(itemDragStartRef.current.itemId);
            selectedIdsRef.current = newIds;
            setSelectedIds(newIds);
          }
          justItemDraggedRef.current = true;
          draggingItemsRef.current = true;
          setDraggingItems(true);
          setItemDragPos({ x: e.clientX, y: e.clientY });
        }
      }
      if (draggingItemsRef.current) {
        setItemDragPos({ x: e.clientX, y: e.clientY });
        const cont = catTabsContainerRef.current;
        if (cont) {
          const tabEls = cont.querySelectorAll<HTMLElement>('[data-cat-id]');
          let found: string | null = null;
          for (const tab of tabEls) {
            const rect = tab.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
              const id = tab.getAttribute('data-cat-id');
              if (id) { found = id; break; }
            }
          }
          if (found !== itemDropTargetRef.current) { itemDropTargetRef.current = found; setItemDropTarget(found); }
        }
      }
    };
    const onUp = (e?: Event) => {
      const isCancel = e?.type === 'pointercancel';
      itemDragStartRef.current = null;
      document.body.style.userSelect = '';
      if (justItemDraggedRef.current) setTimeout(() => { justItemDraggedRef.current = false; }, 50);
      if (draggingItemsRef.current) {
        if (!isCancel && itemDropTargetRef.current) {
          const catId = itemDropTargetRef.current;
          const catName = categoriesRef.current.find(c => c.id === catId)?.name ?? catId;
          const count = selectedIdsRef.current.size;
          onPendingMove(catId, catName, count);
        }
        draggingItemsRef.current = false; itemDropTargetRef.current = null;
        setDraggingItems(false); setItemDropTarget(null);
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
    };
  }, [catTabsContainerRef, selectedIdsRef, setSelectedIds, onPendingMove]);

  const startItemDrag = (e: React.PointerEvent, itemId: string) => {
    const target = e.target as HTMLElement;
    const inputEl = target.closest('input') as HTMLInputElement | null;
    if (target.closest('button, select') || (inputEl && inputEl.type !== 'checkbox')) return;
    itemDragStartRef.current = { x: e.clientX, y: e.clientY, itemId };
    document.body.style.userSelect = 'none';
  };

  return { draggingItems, itemDragPos, itemDropTarget, justItemDraggedRef, startItemDrag };
}
