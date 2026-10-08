import { describe, expect, it } from 'vitest';
import { dayMonth, repairFault, repairOverdue, repairPrice } from './repairs';

describe('repair desk helpers', () => {
  it('shows the fault text, a quote when there is no budget, and overdue dates', () => {
    expect(repairFault({ fault: 'Pantalla rota', faultTags: ['Pantalla'] })).toBe('Pantalla rota');
    expect(repairFault({ fault: '  ', faultTags: ['Batería'] })).toBe('Batería');
    expect(repairPrice(145000, 'quote')).toBe('$ 145.000');
    expect(repairPrice(null, 'quote')).toBe('A cotizar');
    expect(repairPrice(null, 'dash')).toBe('—');
    expect(dayMonth('06/10/2026')).toBe('06/10');
    expect(repairOverdue({ status: 'RECIBIDO', estimatedDelivery: '01/01/2020' }, new Date(2026, 9, 8))).toBe(true);
    expect(repairOverdue({ status: 'ENTREGADO', estimatedDelivery: '01/01/2020' }, new Date(2026, 9, 8))).toBe(false);
    expect(repairOverdue({ status: 'RECIBIDO', estimatedDelivery: '31/12/2026' }, new Date(2026, 9, 8))).toBe(false);
  });
});
