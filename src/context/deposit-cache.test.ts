import { describe, expect, it } from 'vitest';
import { depositLoadIsCurrent, depositLoadTicket, noteDepositMutation } from './deposit-cache';

describe('deposit list generation', () => {
  it('drops a load that started before the refund was saved', () => {
    let generations: Record<string, number> = {};
    const started = depositLoadTicket(generations, 'c1');
    generations = noteDepositMutation(generations, 'c1');
    expect(depositLoadIsCurrent(generations, 'c1', started)).toBe(false);
    const next = depositLoadTicket(generations, 'c1');
    expect(depositLoadIsCurrent(generations, 'c1', next)).toBe(true);
  });
});
