import { useState, useRef, useEffect } from 'react';

const MIN_COL_WIDTH = 40;

export function useColResize(
  colWidths: Record<string, number>,
  setColWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>
) {
  const [activeResizeCol, setActiveResizeCol] = useState<string | null>(null);
  const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    if (activeResizeCol) { document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }
    else { document.body.style.cursor = ''; document.body.style.userSelect = ''; }
    return () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; };
  }, [activeResizeCol]);

  const handleResizeStart = (e: React.PointerEvent, col: string) => {
    e.preventDefault(); e.stopPropagation();
    resizingRef.current = { col, startX: e.clientX, startW: colWidths[col] };
    setActiveResizeCol(col);
    const onMove = (ev: PointerEvent) => {
      if (!resizingRef.current) return;
      const newW = Math.max(MIN_COL_WIDTH, resizingRef.current.startW + (ev.clientX - resizingRef.current.startX));
      setColWidths(prev => ({ ...prev, [resizingRef.current!.col]: newW }));
    };
    const onUp = () => {
      setActiveResizeCol(null); resizingRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { activeResizeCol, handleResizeStart };
}
