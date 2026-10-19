/** A list read that started before a later write must not replace that write. */
export function snapshotIsCurrent(seen: number, current: number) {
  return seen === current;
}

/** Bump before a write so a refresh already in flight cannot paint stale rows afterwards. */
export function beginListWrite(generation: { current: number }) {
  generation.current += 1;
  return generation.current;
}
