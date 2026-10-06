import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { LONG_PRESS_MS } from './logic';

export function useLongPress(onLongPress: (point: { x: number; y: number }) => void, onPress: () => void) {
  const timer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const fired = useRef(false);
  const [holding, setHolding] = useState(false);

  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  return {
    holding,
    onPointerDown: (event: PointerEvent) => {
      fired.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      setHolding(true);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        setHolding(false);
        onLongPress({ x: event.clientX, y: event.clientY });
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: PointerEvent) => {
      if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onClick: (event: MouseEvent) => {
      if (fired.current) {
        event.preventDefault();
        event.stopPropagation();
        fired.current = false;
        return;
      }
      onPress();
    },
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
      clear();
      fired.current = true;
      onLongPress({ x: event.clientX, y: event.clientY });
    },
  };
}
