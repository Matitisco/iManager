/** A list read that started before a later write must not replace that write. */
export function snapshotIsCurrent(seen: number, current: number) {
  return seen === current;
}
