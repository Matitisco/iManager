import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

/** Structural sharing for API JSON. Unchanged rows survive even a list reorder. */
export function keepIfEqual<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous;
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object') return next;
  if (Array.isArray(previous) && Array.isArray(next)) {
    const byId = new Map<unknown, unknown>();
    for (const row of previous) if (row && typeof row === 'object' && 'id' in row) byId.set(row.id, row);
    let equal = previous.length === next.length;
    const shared = next.map((row, index) => {
      const old = row && typeof row === 'object' && 'id' in row ? byId.get(row.id) : previous[index];
      const value = keepIfEqual(old, row);
      if (value !== previous[index]) equal = false;
      return value;
    });
    return (equal ? previous : shared) as T;
  }
  if (Array.isArray(previous) || Array.isArray(next)) return next;
  if (Object.getPrototypeOf(previous) !== Object.prototype || Object.getPrototypeOf(next) !== Object.prototype) return next;
  const before = previous as Record<string, unknown>, after = next as Record<string, unknown>;
  const keys = Object.keys(after);
  let equal = Object.keys(before).length === keys.length;
  const shared: Record<string, unknown> = { ...after };
  for (const key of keys) {
    shared[key] = keepIfEqual(before[key], after[key]);
    if (!Object.prototype.hasOwnProperty.call(before, key) || shared[key] !== before[key]) equal = false;
  }
  return (equal ? previous : shared) as T;
}

export function useStableState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initial);
  const setStable = useCallback<Dispatch<SetStateAction<T>>>(update => {
    setValue(previous => keepIfEqual(previous, typeof update === 'function' ? (update as (old: T) => T)(previous) : update));
  }, []);
  return [value, setStable];
}
