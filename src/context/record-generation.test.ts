import { describe, expect, it } from 'vitest';
import { snapshotIsCurrent } from './record-generation';

describe('snapshotIsCurrent', () => {
  it('drops a read that started before a payment or a cancellation', () => {
    const started = 4;
    const afterWrite = started + 1;
    expect(snapshotIsCurrent(started, afterWrite)).toBe(false);
    expect(snapshotIsCurrent(afterWrite, afterWrite)).toBe(true);
  });
});
