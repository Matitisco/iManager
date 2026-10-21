import { createContext, useContext, useLayoutEffect, useState, type RefObject } from 'react';

interface ModalLayer {
  parent: ModalLayer | null;
  ref: RefObject<HTMLElement | null>;
  initialFocus?: RefObject<HTMLElement | null>;
  trigger: HTMLElement | null;
  busy: boolean;
  onClose: () => void;
}

/** Parentage follows React, including confirmations rendered through a portal. */
export const ModalLayerContext = createContext<ModalLayer | null>(null);
const layers: ModalLayer[] = [];

function descendsFrom(layer: ModalLayer, ancestor: ModalLayer): boolean {
  for (let parent = layer.parent; parent; parent = parent.parent) {
    if (parent === ancestor) return true;
  }
  return false;
}

function topLayer() {
  return layers.filter(layer => !layers.some(other => descendsFrom(other, layer))).at(-1);
}

function canFocus(node: HTMLElement) {
  if (!node.isConnected || node.matches(':disabled') || node.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
  for (let current: HTMLElement | null = node; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

function focusLayer(layer: ModalLayer) {
  const initial = layer.initialFocus?.current;
  const node = initial && canFocus(initial) ? initial : layer.ref.current;
  node?.focus({ preventScroll: true });
}

function requestClose(layer: ModalLayer) {
  if (topLayer() === layer && !layer.busy) layer.onClose();
}

function keydown(event: KeyboardEvent) {
  const layer = topLayer();
  const surface = layer?.ref.current;
  if (!layer || !surface || event.defaultPrevented) return;
  if (event.key === 'Escape') {
    // Consume busy Escape too, before legacy window listeners can close a parent.
    event.preventDefault();
    event.stopImmediatePropagation();
    requestClose(layer);
  } else if (event.key === 'Tab') {
    const controls = [...surface.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex], [contenteditable="true"]')]
      .filter(node => node.tabIndex >= 0 && canFocus(node));
    const first = controls[0];
    const last = controls.at(-1);
    const active = document.activeElement;
    if (!first || !surface.contains(active) || active === surface || (event.shiftKey ? active === first : active === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus({ preventScroll: true });
      if (!first) focusLayer(layer);
    }
  }
}

function focusin(event: FocusEvent) {
  const layer = topLayer();
  if (layer && event.target instanceof Node && !layer.ref.current?.contains(event.target)) focusLayer(layer);
}

function restoreFocus(layer: ModalLayer) {
  const top = topLayer();
  for (let current: ModalLayer | null = layer; current; current = current.parent) {
    const target = current.trigger;
    if (target && canFocus(target) && (!top || top.ref.current?.contains(target))) {
      target.focus({ preventScroll: true });
      return;
    }
  }
  if (top && !top.ref.current?.contains(document.activeElement)) focusLayer(top);
}

/** Interaction only: callers keep their layout, permissions and async callbacks. */
export function useModalLayer({ ref, onClose, busy = false, enabled = true, initialFocus }: {
  ref: RefObject<HTMLElement | null>;
  onClose: () => void;
  busy?: boolean;
  enabled?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const parent = useContext(ModalLayerContext);
  const [scope] = useState<ModalLayer>(() => ({
    parent, ref, onClose, busy, initialFocus,
    trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null,
  }));

  useLayoutEffect(() => {
    Object.assign(scope, { parent, ref, onClose, busy, initialFocus });
  });

  useLayoutEffect(() => {
    if (!enabled) return;
    // Child layout effects may run first on a simultaneous parent/child mount.
    // Preserve the outer trigger captured before the child moved focus.
    if (!layers.some(other => descendsFrom(other, scope)) && !scope.ref.current?.contains(document.activeElement)) {
      scope.trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    layers.push(scope);
    if (layers.length === 1) {
      document.addEventListener('keydown', keydown);
      document.addEventListener('focusin', focusin);
    }
    if (topLayer() === scope && !scope.ref.current?.contains(document.activeElement)) focusLayer(scope);
    return () => {
      layers.splice(layers.indexOf(scope), 1);
      if (layers.length === 0) {
        document.removeEventListener('keydown', keydown);
        document.removeEventListener('focusin', focusin);
      }
      // Wait for DOM removal and sibling/parent cleanup before choosing a target.
      queueMicrotask(() => restoreFocus(scope));
    };
  }, [enabled, scope]);

  return { scope, requestClose: () => requestClose(scope) };
}
