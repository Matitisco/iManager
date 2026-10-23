import { describe, expect, it } from 'vitest';
import { placeMenu } from './menu-position';

const viewport = { width: 1440, height: 620 };
const size = { width: 220, height: 187 };
const place = (x: number, y: number) => placeMenu({ anchor: { x, y }, size, viewport });

describe('placeMenu', () => {
  it('opens at the cursor with a small gap when there is room', () => {
    expect(place(464, 345)).toMatchObject({ left: 467, top: 348, transformOrigin: 'top left' });
  });

  it('flips left at the right edge', () => {
    expect(place(1400, 200)).toMatchObject({ left: 1177, top: 203, transformOrigin: 'top right' });
  });

  it('flips up at the bottom edge', () => {
    expect(place(464, 580)).toMatchObject({ left: 467, top: 390, transformOrigin: 'bottom left' });
  });

  it('flips both axes at the bottom right corner', () => {
    expect(place(1400, 580)).toMatchObject({ left: 1177, top: 390, transformOrigin: 'bottom right' });
  });

  it('clamps oversized menus and provides their scrollable limits', () => {
    expect(placeMenu({ anchor: { x: 80, y: 80 }, size, viewport: { width: 180, height: 150 } }))
      .toMatchObject({ left: 12, top: 12, maxWidth: 156, maxHeight: 126 });
  });

  it('clamps anchors outside the viewport and supports custom margins and gaps', () => {
    expect(place(-20, -50)).toMatchObject({ left: 12, top: 12 });
    expect(placeMenu({ anchor: { x: 2, y: 3 }, size, viewport, margin: 8, gap: 4 }))
      .toMatchObject({ left: 8, top: 8, maxHeight: 604 });
  });

  it.each([100, 187])('keeps a %s px menu next to the cursor using its actual height', height => {
    const result = placeMenu({ anchor: { x: 464, y: 580 }, size: { ...size, height }, viewport });
    expect(result.top + height).toBe(577);
    expect(result.left).toBe(467);
  });

  it('only flips the taller menu when the shorter menu still fits below', () => {
    expect(placeMenu({ anchor: { x: 464, y: 450 }, size: { ...size, height: 100 }, viewport }).top).toBe(453);
    expect(place(464, 450).top).toBe(260);
  });

  it('uses the offset and dimensions of the visual viewport', () => {
    const shifted = { offsetLeft: 300, offsetTop: 150, width: 400, height: 300 };
    expect(placeMenu({ anchor: { x: 680, y: 420 }, size, viewport: shifted }))
      .toMatchObject({ left: 457, top: 230, maxWidth: 376, maxHeight: 276 });
    expect(placeMenu({ anchor: { x: 100, y: 100 }, size, viewport: shifted }))
      .toMatchObject({ left: 312, top: 162 });
  });

  it('opens below a button aligned to its right edge', () => {
    expect(placeMenu({ anchor: { x: 500, y: 240, anchorTop: 208, anchorBottom: 240, anchorRight: 532 }, size, viewport }))
      .toMatchObject({ left: 312, top: 243, transformOrigin: 'top right' });
  });

  it('aligns to the left edge of a button near the left boundary', () => {
    expect(placeMenu({ anchor: { x: 20, y: 240, anchorTop: 208, anchorBottom: 240, anchorRight: 52 }, size, viewport }))
      .toMatchObject({ left: 20, top: 243, transformOrigin: 'top left' });
  });

  it('opens above a button without overlapping it', () => {
    const anchor = { x: 500, y: 580, anchorTop: 548, anchorBottom: 580, anchorRight: 532 };
    const result = placeMenu({ anchor, size, viewport });
    expect(result).toMatchObject({ left: 312, top: 358, transformOrigin: 'bottom right' });
    expect(result.top + size.height).toBe(anchor.anchorTop - 3);
  });

  it('scrolls on the larger side when neither side of the button fits', () => {
    const result = placeMenu({ anchor: { x: 100, y: 140, anchorTop: 108, anchorBottom: 140, anchorRight: 132 }, size, viewport: { width: 800, height: 300 } });
    expect(result).toMatchObject({ top: 143, maxHeight: 145 });
    expect(result.top + result.maxHeight).toBe(288);
  });
});
