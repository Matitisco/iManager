import { createContext, useContext, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { canonicalHash } from './hash-route';

const ENTRY_STATE = 'deskEntry';
type Entry = { id: string; hash: string; top: number; values: Map<string, unknown>; from?: string };
export const RoutePresentation = createContext<Map<string, unknown> | null>(null);

/** Presentation only, scoped to this history entry; never stores records or form drafts. */
export function useNavigationState<T>(key: string | null, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const values = useContext(RoutePresentation);
  const [value, setValue] = useState<T>(() => key && values?.has(key) ? values.get(key) as T : typeof initial === 'function' ? (initial as () => T)() : initial);
  useLayoutEffect(() => { if (key) values?.set(key, value); }, [key, values, value]);
  return [value, setValue];
}

/** The actual shell scroll container, independent of window scrolling or overlay renders. */
export function useRouteViewport(scope: string) {
  const stageRef = useRef<HTMLElement>(null);
  const entries = useRef(new Map<string, Entry>());
  const active = useRef<Entry | null>(null);
  const activeScope = useRef(scope);
  const sequence = useRef(0);
  const readEntry = () => {
    if (activeScope.current !== scope) {
      entries.current.clear();
      active.current = null;
      activeScope.current = scope;
    }
    const hash = canonicalHash(window.location.hash) ?? window.location.hash;
    const id = history.state?.[ENTRY_STATE];
    const known = typeof id === 'string' ? entries.current.get(id) : undefined;
    if (known?.hash === hash) return known;
    const entry: Entry = { id: `${Date.now()}-${++sequence.current}`, hash, top: 0, values: new Map(), from: active.current?.id };
    entries.current.set(entry.id, entry);
    history.replaceState({ ...history.state, [ENTRY_STATE]: entry.id }, '', window.location.href);
    return entry;
  };
  const [entry, setEntry] = useState(readEntry);
  if (!active.current) active.current = entry;

  const syncRoute = () => {
    const next = readEntry();
    if (next.id === active.current?.id) return;
    // Read before React replaces the outgoing page and the browser clamps scrollTop.
    if (active.current && stageRef.current) active.current.top = stageRef.current.scrollTop;
    active.current = next;
    setEntry(next);
  };

  useLayoutEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => { history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const desired = entry.top;
    let restoring = true;
    let observer: ResizeObserver | undefined;
    const stop = () => { restoring = false; observer?.disconnect(); };
    const restore = () => {
      if (!restoring) return;
      stage.scrollTop = desired;
      if (Math.abs(stage.scrollTop - desired) < 1) stop();
    };
    restore();
    // An archived list can arrive after navigation. Only a history restoration
    // retries; new pages are positioned once and never reset on async updates.
    if (restoring && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(restore);
      if (stage.firstElementChild) observer.observe(stage);
      for (const child of stage.children) observer.observe(child);
    }
    const onScroll = () => { if (!restoring) entry.top = stage.scrollTop; };
    const onInteraction = () => { stop(); entry.top = stage.scrollTop; };
    stage.addEventListener('scroll', onScroll);
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) stage.addEventListener(event, onInteraction, { passive: true });
    return () => {
      stop();
      stage.removeEventListener('scroll', onScroll);
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) stage.removeEventListener(event, onInteraction);
    };
  }, [entry]);

  const backToMore = (fallback: () => void) => {
    if (entry.from && entries.current.get(entry.from)?.hash === '#/mas') history.back();
    else fallback();
  };
  return { stageRef, entry, syncRoute, backToMore };
}

/** Reserve exactly the visible action bar height above the mobile navigation. */
export function useMobileActionClearance(stageRef: { current: HTMLElement | null }, routeKey: string) {
  useLayoutEffect(() => {
    const shell = stageRef.current?.closest<HTMLElement>('.desk-app');
    if (!shell || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const bars = shell.querySelectorAll<HTMLElement>('.mdock, .phone-save, .bulk-bar.mobile');
      const height = Math.max(0, ...Array.from(bars, bar => bar.getBoundingClientRect().height));
      shell.style.setProperty('--mobile-actions-height', `${height}px`);
    };
    const resize = new ResizeObserver(measure);
    const observe = () => {
      resize.disconnect();
      for (const bar of shell.querySelectorAll('.mdock, .phone-save, .bulk-bar.mobile')) resize.observe(bar);
      measure();
    };
    const changes = new MutationObserver(observe);
    changes.observe(shell, { childList: true, subtree: true });
    observe();
    return () => { changes.disconnect(); resize.disconnect(); shell.style.removeProperty('--mobile-actions-height'); };
  }, [stageRef, routeKey]);
}
