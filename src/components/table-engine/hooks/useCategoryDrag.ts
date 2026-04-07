import { useState, useRef, useEffect } from 'react';
import type { TableCategory } from '../types';

export function useCategoryDrag(
  categories: TableCategory[],
  onReorderCategories?: (ids: string[]) => Promise<void>
) {
  const [draggingCat, setDraggingCat] = useState<{ id: string; label: string } | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const draggingCatRef = useRef<{ id: string; label: string } | null>(null);
  const dropTargetIdRef = useRef<string | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; catId: string; label: string } | null>(null);
  const catTabsContainerRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef(categories);
  const justDraggedRef = useRef(false);

  useEffect(() => { categoriesRef.current = categories; }, [categories]);

  useEffect(() => {
    if (draggingCat) document.body.style.cursor = 'none';
    else document.body.style.cursor = '';
    return () => { document.body.style.cursor = ''; };
  }, [draggingCat]);

  useEffect(() => {
    const DRAG_THRESHOLD = 5;
    const onMove = (e: PointerEvent) => {
      if (pointerStartRef.current && !draggingCatRef.current) {
        const dx = e.clientX - pointerStartRef.current.x;
        const dy = e.clientY - pointerStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          const { catId, label } = pointerStartRef.current;
          draggingCatRef.current = { id: catId, label };
          setDraggingCat({ id: catId, label });
          setDragPos({ x: e.clientX, y: e.clientY });
        }
      }
      if (draggingCatRef.current) {
        setDragPos({ x: e.clientX, y: e.clientY });
        const cont = catTabsContainerRef.current;
        if (cont) {
          const tabEls = cont.querySelectorAll<HTMLElement>('[data-cat-id]');
          let found: string | null = null;
          for (const tab of tabEls) {
            const rect = tab.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
              const id = tab.getAttribute('data-cat-id');
              if (id && id !== draggingCatRef.current.id) { found = id; break; }
            }
          }
          if (found !== dropTargetIdRef.current) { dropTargetIdRef.current = found; setDropTargetId(found); }
        }
      }
    };
    const onUp = () => {
      if (draggingCatRef.current) {
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 50);
        if (dropTargetIdRef.current && onReorderCategories) {
          const draggedId = draggingCatRef.current.id;
          const targetId = dropTargetIdRef.current;
          const cats = categoriesRef.current;
          const from = cats.findIndex(c => c.id === draggedId);
          const to = cats.findIndex(c => c.id === targetId);
          if (from !== -1 && to !== -1) {
            const reordered = [...cats];
            const [moved] = reordered.splice(from, 1);
            reordered.splice(to, 0, moved);
            onReorderCategories(reordered.map(c => c.id));
          }
        }
      }
      draggingCatRef.current = null; dropTargetIdRef.current = null; pointerStartRef.current = null;
      setDraggingCat(null); setDropTargetId(null);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
  }, [onReorderCategories]);

  const startCatDrag = (e: React.PointerEvent, catId: string, label: string) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY, catId, label };
  };

  return { draggingCat, dragPos, dropTargetId, catTabsContainerRef, justDraggedRef, startCatDrag };
}
