import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairOrder } from '../types';
import { RepairOrderDetail, RepairOrderEditor, RepairOrderForm } from './RepairForms';
import { ExchangeProvider } from './exchange';
import { DeskProvider } from './ui';

const state = vi.hoisted(() => ({
  appSession: { membership: { role: 'OWNER', sections: [] as string[] } },
  clients: [],
  repairOrders: [] as RepairOrder[],
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => state }));

function desk(children: ReactNode, currency: 'ARS' | 'USD' = 'ARS', canManageSensitive = true) {
  return render(
    <ExchangeProvider settings={{ currency, exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1000 }}>
      <DeskProvider value={{ tab: 'service', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false, canManageSensitive }}>
        {children}
      </DeskProvider>
    </ExchangeProvider>,
  );
}

function profitValue() {
  return screen.getByText('Ganancia', { exact: true }).parentElement!.querySelector('b')!;
}

beforeEach(() => {
  state.appSession.membership = { role: 'OWNER', sections: [] };
  state.repairOrders = [{
    id: 'r1', orderNumber: 1, code: 'OT-0001', clientId: null, clientName: null, clientPhone: null,
    device: 'Equipo de prueba', imei: '', fault: 'Pantalla', faultTags: ['Pantalla'],
    estimate: 85000, deposit: 100000, currency: 'ARS', technician: '', status: 'RECIBIDO',
    estimatedDelivery: null, notifyWhatsapp: false, receivedAt: '03/11/2026', whatsappUrl: null, events: [],
  }];
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe.each([false, true])('ganancia de reparación (móvil: %s)', phone => {
  beforeEach(() => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      media: query, matches: phone && query.includes('max-width'), onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
  });

  describe.each(['alta', 'edición', 'detalle'] as const)('%s', view => {
    function show(currency: 'ARS' | 'USD' = 'ARS', canManageSensitive = true) {
      desk(view === 'alta' ? <RepairOrderForm busy={false} error={null} />
        : view === 'edición' ? <RepairOrderEditor id="r1" busy={false} />
          : <RepairOrderDetail id="r1" busy={false} />, currency, canManageSensitive);
      if (view === 'alta') {
        fireEvent.change(screen.getByLabelText('Costo del arreglo'), { target: { value: '85000' } });
        fireEvent.change(screen.getByLabelText('Lo que abonó el cliente'), { target: { value: '100000' } });
      }
    }

    it.each([
      ['OWNER', [], true],
      ['STAFF', ['service'], true], // #691: STAFF conserva acceso a costos y ganancia.
      ['MANAGER', ['service', 'reports'], true],
      ['MANAGER', ['service'], false],
    ] as const)('usa la regla de Ventas para %s con %j', (role, sections, allowed) => {
      state.appSession.membership = { role, sections: [...sections] };
      show('ARS', false);
      if (allowed) {
        expect(profitValue()).toHaveTextContent('$ 15.000');
        expect(profitValue()).toHaveAttribute('data-ph-mask');
      } else {
        expect(screen.queryByText('Ganancia', { exact: true })).not.toBeInTheDocument();
        expect(screen.queryByText('$ 15.000', { exact: true })).not.toBeInTheDocument();
      }
    });

    it.each([
      [null, 100000, '—'],
      [85000, undefined, '—'],
      [null, undefined, '—'],
      [85000, 0, '$ -85.000'],
      [0, 100000, '$ 100.000'],
      [0, 0, '$ 0'],
    ] as const)('distingue faltantes de cero: costo %s y abonado %s', (cost, paid, expected) => {
      if (view === 'alta') {
        show();
        fireEvent.change(screen.getByLabelText('Costo del arreglo'), { target: { value: cost == null ? '' : String(cost) } });
        fireEvent.change(screen.getByLabelText('Lo que abonó el cliente'), { target: { value: paid == null ? '' : String(paid) } });
      } else if (view === 'edición' && paid == null) {
        state.repairOrders[0].estimate = cost;
        show();
        fireEvent.change(screen.getByLabelText('Lo que abonó el cliente'), { target: { value: '' } });
      } else {
        Object.assign(state.repairOrders[0], { estimate: cost, deposit: paid });
        show();
      }
      expect(profitValue()).toHaveTextContent(expected);
    });

    if (view === 'detalle') it.each([
      { estimate: Number.NaN }, { deposit: Number.POSITIVE_INFINITY }, { deposit: null },
    ])('muestra — con un monto ausente o inválido: %j', amounts => {
      Object.assign(state.repairOrders[0], amounts);
      show();
      expect(profitValue()).toHaveTextContent('—');
    });

    if (view !== 'alta') it('respeta la moneda de la vista sin modificar los importes guardados', () => {
      Object.assign(state.repairOrders[0], { estimate: 85, deposit: 100, currency: 'USD' });
      const original = structuredClone(state.repairOrders[0]);
      show();
      expect(profitValue()).toHaveTextContent('$ 15.000');
      expect(state.repairOrders[0]).toEqual(original);
      cleanup();
      show('USD');
      expect(profitValue()).toHaveTextContent('US$ 15');
    });

    if (view !== 'detalle') it('recalcula al editar y vuelve a — al vaciar cualquier monto', () => {
      show();
      fireEvent.change(screen.getByLabelText('Lo que abonó el cliente'), { target: { value: '110000' } });
      expect(profitValue()).toHaveTextContent('$ 25.000');
      fireEvent.change(screen.getByLabelText('Costo del arreglo'), { target: { value: '' } });
      expect(profitValue()).toHaveTextContent('—');
      fireEvent.change(screen.getByLabelText('Costo del arreglo'), { target: { value: '50000' } });
      expect(profitValue()).toHaveTextContent('$ 60.000');
      fireEvent.change(screen.getByLabelText('Lo que abonó el cliente'), { target: { value: '' } });
      expect(profitValue()).toHaveTextContent('—');
    });
  });
});
