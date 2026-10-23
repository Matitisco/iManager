import { describe, expect, it } from 'vitest';
import { placeCalendar, type CalendarBounds } from './date-picker-position';

const rect = (left: number, top: number, width: number, height: number): CalendarBounds => ({ left, top, right: left + width, bottom: top + height });

describe('sale calendar placement', () => {
  it.each([390, 1440])('aligns below the field with an 8px gap at %s px', width => {
    const left = width === 390 ? 16 : 478;
    const anchor = rect(left, 200, 350, 48);
    const bounds = rect(width === 390 ? 12 : 462, 140, width === 390 ? 366 : 516, 600);
    const result = placeCalendar(anchor, bounds);
    expect(result.left).toBe(left);
    expect(result.top).toBe(anchor.bottom + 8);
    expect(result.width).toBe(296);
    expect(result.top + Math.min(373, result.maxHeight)).toBeLessThanOrEqual(bounds.bottom);
  });

  it('flips above when that side fits, without overlapping the field', () => {
    const anchor = rect(478, 650, 484, 48);
    expect(placeCalendar(anchor, rect(462, 166, 516, 591))).toEqual({ left: 478, top: 269, width: 296, maxHeight: 476 });
  });

  it.each([
    { anchor: rect(16, 330, 358, 48), bounds: rect(12, 144, 366, 438), top: 386, maxHeight: 196 },
    { anchor: rect(16, 390, 358, 48), bounds: rect(12, 144, 366, 438), top: 144, maxHeight: 238 },
  ])('uses the larger side with scrollable height when neither fits: $top', ({ anchor, bounds, top, maxHeight }) => {
    expect(placeCalendar(anchor, bounds)).toMatchObject({ top, maxHeight });
  });

  it('fits narrow visual viewports and clamps horizontally at the right edge', () => {
    expect(placeCalendar(rect(250, 100, 80, 48), rect(30, 20, 240, 500))).toMatchObject({ left: 30, width: 240 });
    expect(placeCalendar(rect(350, 100, 30, 48), rect(12, 20, 366, 500))).toMatchObject({ left: 82, width: 296 });
  });

  it('uses the measured calendar height when its content changes', () => {
    const anchor = rect(16, 330, 358, 48);
    const bounds = rect(12, 144, 366, 438);
    expect(placeCalendar(anchor, bounds, 150).top).toBe(386);
    expect(placeCalendar(anchor, bounds, 420).maxHeight).toBe(196);
  });

  it('shows the full calendar beside the sale field at 1440×620 instead of cropping it to the sheet', () => {
    const anchor = rect(478, 369, 484, 48);
    const result = placeCalendar(anchor, rect(458, 149, 524, 345), 373, rect(12, 12, 1416, 596));
    expect(result).toEqual({ left: 970, top: 235, width: 296, maxHeight: 596 });
    expect(result.top + 373).toBe(608);
    expect(result.left).toBe(anchor.right + 8);
  });

  it('moves to the left side when the right side has no room', () => {
    expect(placeCalendar(rect(1100, 369, 200, 48), rect(1000, 149, 350, 345), 373, rect(12, 12, 1416, 596)))
      .toMatchObject({ left: 796, top: 235, maxHeight: 596 });
  });

  it.each([250, 420])('uses the measured %s px height for the fallback position', height => {
    const result = placeCalendar(rect(478, 369, 484, 48), rect(458, 200, 524, 294), height, rect(12, 12, 1416, 596));
    expect(result.top).toBe(608 - height);
    expect(result.maxHeight).toBeGreaterThanOrEqual(height);
  });

  it('keeps the original placement when the sheet has enough room', () => {
    const anchor = rect(478, 200, 484, 48);
    const bounds = rect(458, 148, 524, 600);
    expect(placeCalendar(anchor, bounds, 373, rect(12, 12, 1416, 876))).toEqual(placeCalendar(anchor, bounds, 373));
  });

  it('repositions vertically in a narrow visual viewport with an offset', () => {
    const viewport = rect(42, 62, 296, 506);
    const result = placeCalendar(rect(46, 300, 280, 48), rect(42, 250, 296, 150), 373, viewport);
    expect(result).toEqual({ left: 42, top: 62, width: 296, maxHeight: 506 });
  });

  it('only constrains the panel when the visual viewport itself is smaller', () => {
    expect(placeCalendar(rect(46, 100, 140, 48), rect(42, 70, 150, 90), 373, rect(42, 62, 180, 176)))
      .toEqual({ left: 42, top: 62, width: 180, maxHeight: 176 });
  });
});
