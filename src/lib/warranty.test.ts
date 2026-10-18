import { describe, expect, it } from 'vitest';
import {
  clientCoverageLines,
  coverageHeadline,
  coverageState,
  defaultSaleWarrantyDays,
  deviceCoverageLines,
  repairWarrantyView,
  saleWarrantyView,
  warrantyDueCopy,
  warrantyUntil,
} from './warranty';
import { formatArDate, parseArDate } from './ar-date';
import type { RepairOrder, Sale } from '../types';

const sale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 's1',
  date: '01/10/2026',
  clientId: 'c1',
  productId: 'p1',
  deviceLabel: 'iPhone 13',
  amount: 100,
  paymentMethod: 'EFECTIVO',
  status: 'COMPLETADA',
  warrantyDays: 10,
  ...overrides,
});

const repair = (overrides: Partial<RepairOrder> = {}): RepairOrder => ({
  id: 'r1',
  orderNumber: 1,
  code: 'OT-0001',
  clientId: 'c1',
  clientName: 'Ana',
  clientPhone: '',
  device: 'iPhone 13',
  imei: '350000000000001',
  fault: 'Batería',
  faultTags: [],
  estimate: 1000,
  deposit: 200,
  technician: '',
  status: 'ENTREGADO',
  estimatedDelivery: null,
  notifyWhatsapp: false,
  receivedAt: '01/10/2026',
  whatsappUrl: null,
  warrantyDays: 10,
  events: [{ id: 'e1', status: 'ENTREGADO', createdAt: '01/10/2026' }],
  ...overrides,
});

describe('warranty due copy', () => {
  it('adds the chosen days to the sale date', () => {
    expect(warrantyDueCopy('17/10/2026', 60)).toBe('Vence el 16/12/2026');
    expect(warrantyDueCopy('2026-10-17', 30)).toBe('Vence el 16/11/2026');
    expect(warrantyDueCopy('17/10/2026', 0)).toBe('Sin garantía');
    expect(warrantyDueCopy('17/10/2026', null)).toBe('');
  });
});

describe('warranty coverage', () => {
  it('shifts the sale end date when the sale date changes and keeps the last day covered', () => {
    const first = saleWarrantyView(sale(), parseArDate('11/10/2026')!);
    const shifted = saleWarrantyView(sale({ date: '05/10/2026' }), parseArDate('11/10/2026')!);
    expect(first.untilLabel).toBe('11/10/2026');
    expect(first.state).toBe('vigente');
    expect(shifted.untilLabel).toBe('15/10/2026');
    expect(saleWarrantyView(sale(), parseArDate('12/10/2026')!).state).toBe('vencida');
    expect(saleWarrantyView(sale({ status: 'CANCELADA' })).phrase).toBe('Sin cobertura');
    expect(warrantyUntil(parseArDate('01/10/2026'), 0)).toBeNull();
  });

  it('starts a repair warranty on delivery and uses the shorter default unless the device is sealed', () => {
    expect(repairWarrantyView(repair({ status: 'RECIBIDO', events: [{ id: 'e', status: 'RECIBIDO', createdAt: '01/10/2026' }] })).state).toBe('pendiente');
    expect(repairWarrantyView(repair(), parseArDate('11/10/2026')!).phrase).toBe('Vigente hasta el 11/10/2026');
    expect(defaultSaleWarrantyDays('NUEVO', { usedWarrantyDays: 10, sealedWarrantyDays: 40 })).toBe(40);
    expect(defaultSaleWarrantyDays('OUTLET', { usedWarrantyDays: 10, sealedWarrantyDays: 40 })).toBe(10);
    expect(coverageState(null)).toBe('sin');
  });

  it('shows coverage on the client and on the matching IMEI, skipping cancelled sales', () => {
    const now = parseArDate('02/10/2026')!;
    const lines = clientCoverageLines('c1', [
      sale(),
      sale({ id: 'gone', status: 'CANCELADA' }),
      sale({ id: 'other', clientId: 'c2' }),
    ], [repair({ status: 'RECIBIDO', events: [] })], now);
    expect(lines.map((line) => line.id)).toEqual(['sale-s1', 'repair-r1']);
    expect(coverageHeadline(lines)).toBe('Cubierto');
    const device = deviceCoverageLines(
      { id: 'p1', imei: '350000000000001' },
      [sale({ date: '01/01/2020', warrantyDays: 1 })],
      [repair()],
      now,
    );
    expect(coverageHeadline(device)).toBe('Cubierto');
    expect(device[0]?.detail).toMatch(/Venció/);
    expect(formatArDate(parseArDate('28/02/2024')!)).toBe('28/02/2024');
  });
});
