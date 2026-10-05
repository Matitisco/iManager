import { describe, expect, it } from 'vitest';
import { buildFocusTasks } from './dashboard-focus';

describe('buildFocusTasks', () => {
  it('lists only the pending work and uses singular copy for one item', () => {
    expect(buildFocusTasks({
      sales: [{ status: 'PENDIENTE' }, { status: 'COMPLETADA' }],
      tradeIns: [{ status: 'LISTO' }, { status: 'APROBADO' }],
      inventory: [{ status: 'DISPONIBLE' }],
      clients: [{ pendingBalance: 0 }, { pendingBalance: 1500 }],
    })).toEqual([
      {
        id: 'sales',
        title: '1 venta pendiente',
        description: 'Cerrá las ventas que siguen abiertas.',
        count: 1,
        tab: 'sales',
      },
      {
        id: 'clients',
        title: '1 cliente con saldo',
        description: 'Revisá los saldos que todavía no se cobraron.',
        count: 1,
        tab: 'clients',
      },
    ]);
  });

  it('counts open trade-ins and devices in review', () => {
    const tasks = buildFocusTasks({
      sales: [],
      tradeIns: [
        { status: 'PENDIENTE' },
        { status: 'EN REVISIÓN' },
        { status: 'PERITAJE TÉC.' },
        { status: 'RECHAZADO' },
      ],
      inventory: [{ status: 'EN_REVISION' }, { status: 'EN_REVISION' }, { status: 'VENDIDO' }],
      clients: [],
    });

    expect(tasks.map((task) => task.title)).toEqual([
      '3 canjes en curso',
      '2 equipos en revisión',
    ]);
  });
});
