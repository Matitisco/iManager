export interface CalendarBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const CALENDAR_HEIGHT = 373;
export const CALENDAR_GAP = 8;

/** Coordinates are viewport-relative, like the portaled fixed panel. */
export function placeCalendar(anchor: CalendarBounds, bounds: CalendarBounds, height = CALENDAR_HEIGHT) {
  const width = Math.min(296, Math.max(0, bounds.right - bounds.left));
  const below = Math.max(0, bounds.bottom - anchor.bottom - CALENDAR_GAP);
  const above = Math.max(0, anchor.top - bounds.top - CALENDAR_GAP);
  const openBelow = height <= below || (height > above && below >= above);
  const maxHeight = openBelow ? below : above;
  return {
    width,
    maxHeight,
    left: Math.max(bounds.left, Math.min(anchor.left, bounds.right - width)),
    top: openBelow ? anchor.bottom + CALENDAR_GAP : anchor.top - Math.min(height, maxHeight) - CALENDAR_GAP,
  };
}
