export interface CalendarBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const CALENDAR_HEIGHT = 373;
export const CALENDAR_GAP = 8;

/** Coordinates are viewport-relative, like the portaled fixed panel. */
export function placeCalendar(anchor: CalendarBounds, bounds: CalendarBounds, height = CALENDAR_HEIGHT, viewport?: CalendarBounds) {
  const width = Math.min(296, Math.max(0, bounds.right - bounds.left));
  const below = Math.max(0, bounds.bottom - anchor.bottom - CALENDAR_GAP);
  const above = Math.max(0, anchor.top - bounds.top - CALENDAR_GAP);
  if (viewport && height > Math.max(below, above)) {
    const width = Math.min(296, Math.max(0, viewport.right - viewport.left));
    const maxHeight = Math.max(0, viewport.bottom - viewport.top);
    const panelHeight = Math.min(height, maxHeight);
    const right = anchor.right + CALENDAR_GAP;
    const left = anchor.left - width - CALENDAR_GAP;
    const fitsRight = right + width <= viewport.right;
    const fitsLeft = left >= viewport.left;
    // A short sheet must not crop a panel that fits in the viewport. Prefer
    // beside the field so the calendar does not cover the sheet's actions.
    const top = fitsRight || fitsLeft ? anchor.top
      : anchor.bottom + CALENDAR_GAP + panelHeight <= viewport.bottom
        ? anchor.bottom + CALENDAR_GAP : anchor.top - panelHeight - CALENDAR_GAP;
    return {
      width,
      maxHeight,
      left: Math.max(viewport.left, Math.min(fitsRight ? right : fitsLeft ? left : anchor.left, viewport.right - width)),
      top: Math.max(viewport.top, Math.min(top, viewport.bottom - panelHeight)),
    };
  }
  const openBelow = height <= below || (height > above && below >= above);
  const maxHeight = openBelow ? below : above;
  return {
    width,
    maxHeight,
    left: Math.max(bounds.left, Math.min(anchor.left, bounds.right - width)),
    top: openBelow ? anchor.bottom + CALENDAR_GAP : anchor.top - Math.min(height, maxHeight) - CALENDAR_GAP,
  };
}
