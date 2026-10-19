import { describe, expect, it } from 'vitest';
import { beginListWrite, snapshotIsCurrent } from './record-generation';

describe('snapshotIsCurrent', () => {
  it('drops a read that started before a payment or a cancellation', () => {
    const started = 4;
    const afterWrite = started + 1;
    expect(snapshotIsCurrent(started, afterWrite)).toBe(false);
    expect(snapshotIsCurrent(afterWrite, afterWrite)).toBe(true);
  });

  it('a client rename bumps the generation before the response, so a refresh already in flight cannot restore the old name', () => {
    const generation = { current: 4 };
    const refreshSeen = generation.current;
    const writeSeen = beginListWrite(generation);
    expect(snapshotIsCurrent(refreshSeen, generation.current)).toBe(false);
    expect(snapshotIsCurrent(writeSeen, generation.current)).toBe(true);
  });
});
