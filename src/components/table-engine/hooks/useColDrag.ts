import { useState, useRef, useEffect } from 'react';

export function useColDrag(
  allColIds: string[],
  thRefs: React.MutableRefObject<Record<string, HTMLTableCellElement | null>>,
  setColOrder: React.Dispatch<React.SetStateAction<string[]>>
) {
  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const [dropBeforeColId, setDropBeforeColId] = useState<string | null>(null);
  const [colDragPos, setColDragPos] = useState({ x: 0, y: 0 });
  const colDragStateRef = useRef<{ id: string; dragging: boolean; dropBefore: string | null } | null>(null);

  useEffect(() => {
    if (draggingColId) { document.body.style.cursor = 'none'; document.body.style.userSelect = 'none'; }
    else { document.body.style.cursor = ''; document.body.style.userSelect = ''; }
    return () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; };
  }, [draggingColId]);

  const handleColPointerDown = (e: React.PointerEvent, col: string) => {
    const startX = e.clientX, startY = e.clientY;
    colDragStateRef.current = { id: col, dragging: false, dropBefore: null };
    const onMove = (ev: PointerEvent) => {
      const state = colDragStateRef.current;
      if (!state) return;
      if (!state.dragging) {
        if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
        state.dragging = true;
        setDraggingColId(col);
        setColDragPos({ x: ev.clientX, y: ev.clientY });
      }
      setColDragPos({ x: ev.clientX, y: ev.clientY });
      const sorted = allColIds
        .map(c => ({ c, el: thRefs.current[c] }))
        .filter(({ el }) => !!el)
        .map(({ c, el }) => ({ c, mid: el!.getBoundingClientRect().left + el!.getBoundingClientRect().width / 2 }))
        .sort((a, b) => a.mid - b.mid);
      let dropBefore: string | null = null;
      for (const { c, mid } of sorted) {
        if (c === col) continue;
        if (ev.clientX < mid) { dropBefore = c; break; }
      }
      state.dropBefore = dropBefore;
      setDropBeforeColId(dropBefore);
    };
    const onUp = () => {
      const state = colDragStateRef.current;
      if (state?.dragging) {
        const from = state.id, before = state.dropBefore;
        setColOrder(prev => {
          const next = prev.filter(c => c !== from);
          const idx = before !== null ? next.indexOf(before) : -1;
          next.splice(idx >= 0 ? idx : next.length, 0, from);
          return next;
        });
      }
      colDragStateRef.current = null;
      setDraggingColId(null);
      setDropBeforeColId(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { draggingColId, dropBeforeColId, colDragPos, handleColPointerDown };
}
