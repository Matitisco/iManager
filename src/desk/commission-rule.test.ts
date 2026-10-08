import { describe, expect, it } from 'vitest';
import { commissionPreview, parseCommissionRate, periodChoices, shareLabel } from './commission-rule';

describe('commission rule preview', () => {
  it('describes each way of calculating the sample sale', () => {
    expect(commissionPreview('FIXED_PER_DEVICE', 15000, false)).toBe('En una venta de $ 650.000, le corresponden $ 15.000');
    expect(commissionPreview('PERCENT_SALE', 3, true)).toBe('En una venta de $ 650.000, le corresponden $ 19.500. Los accesorios entran en ese total.');
    expect(commissionPreview('PERCENT_PROFIT', 10, false)).toBe('Sobre $ 150.000 de ganancia, le corresponden $ 15.000.');
    expect(parseCommissionRate('FIXED_PER_DEVICE', '15.000')).toBe(15000);
    expect(parseCommissionRate('PERCENT_SALE', '3,5')).toBe(3.5);
    expect(shareLabel(2.809)).toBe('2,8% de lo vendido');
  });

  it('lists the current month first', () => {
    const options = periodChoices(new Date('2026-10-08T15:00:00.000Z'));
    expect(options[0]).toEqual({ key: '2026-10', label: 'Octubre 2026' });
    expect(options[1]?.key).toBe('2026-09');
    expect(options).toHaveLength(12);
  });
});
