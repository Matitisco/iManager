export interface MenuAnchor {
  x: number;
  y: number;
  anchorTop?: number;
  anchorBottom?: number;
  anchorRight?: number;
}

interface MenuViewport {
  width: number;
  height: number;
  offsetLeft?: number;
  offsetTop?: number;
}

/** All coordinates are relative to the layout viewport, like a fixed menu. */
export function placeMenu({ anchor, size, viewport, margin = 12, gap = 3 }: {
  anchor: MenuAnchor;
  size: { width: number; height: number };
  viewport: MenuViewport;
  margin?: number;
  gap?: number;
}) {
  const minLeft = (viewport.offsetLeft ?? 0) + margin;
  const minTop = (viewport.offsetTop ?? 0) + margin;
  const maxWidth = Math.max(0, viewport.width - 2 * margin);
  let maxHeight = Math.max(0, viewport.height - 2 * margin);
  const width = Math.min(size.width, maxWidth);
  const right = minLeft + maxWidth;
  const bottom = minTop + maxHeight;
  const button = anchor.anchorTop !== undefined && anchor.anchorBottom !== undefined;
  let left = button ? (anchor.anchorRight ?? anchor.x) - width : anchor.x + gap;
  let flipX = button;
  if (button ? left < minLeft || left + width > right : left + width > right) {
    left = button ? anchor.x : anchor.x - width - gap;
    flipX = !button;
  }
  let flipY = anchor.y + gap + Math.min(size.height, maxHeight) > bottom;
  if (button) {
    const below = Math.max(0, bottom - anchor.anchorBottom! - gap);
    const above = Math.max(0, anchor.anchorTop! - minTop - gap);
    flipY = size.height > below && (size.height <= above || above >= below);
    // If neither side fits, scroll on the larger side without covering the button.
    maxHeight = Math.min(maxHeight, flipY ? above : below);
  }
  const height = Math.min(size.height, maxHeight);
  const top = flipY ? (anchor.anchorTop ?? anchor.y) - height - gap : (anchor.anchorBottom ?? anchor.y) + gap;
  return {
    left: Math.max(minLeft, Math.min(left, right - width)),
    top: !button && size.height > maxHeight ? minTop : Math.max(minTop, Math.min(top, bottom - height)),
    maxWidth,
    maxHeight,
    transformOrigin: `${flipY ? 'bottom' : 'top'} ${flipX ? 'right' : 'left'}`,
  };
}
