import { describe, expect, it } from 'vitest';
import { MANUAL_QUOTE_ORDER_ERROR, manualQuoteOrderError } from './manual-quote';

describe('manual quote order', () => {
  it('rejects a buy rate above the sell rate', () => {
    expect(manualQuoteOrderError(1400, 1300)).toBe(MANUAL_QUOTE_ORDER_ERROR);
  });

  it('allows an equal rate and a lower buy rate', () => {
    expect(manualQuoteOrderError(1400, 1400)).toBeNull();
    expect(manualQuoteOrderError(1300, 1400)).toBeNull();
  });

  it('ignores a missing side', () => {
    expect(manualQuoteOrderError(0, 1300)).toBeNull();
    expect(manualQuoteOrderError(1400, 0)).toBeNull();
  });
});
