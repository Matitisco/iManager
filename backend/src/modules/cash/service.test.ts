import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type CashMovement } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { recordCash, reverseCashSource } from './service.js';

vi.mock('../../plugins/prisma.js', () => ({ prisma: {} }));
const box = { id: 'box', storeId: 'store', currency: 'USD', method: 'EFECTIVO' };
const mocks = {
  $executeRaw: vi.fn(),
  store: { findUniqueOrThrow: vi.fn() },
  cashRegister: { findFirst: vi.fn(), update: vi.fn() },
  cashSession: { findFirst: vi.fn() },
  cashMovement: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
};
const tx = mocks as unknown as Prisma.TransactionClient;
const input = { storeId: 'store', amount: 50, currency: 'USD', method: 'EFECTIVO', sourceType: 'sale', sourceId: 'sale', note: 'Cobro' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.store.findUniqueOrThrow.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' });
  mocks.cashMovement.create.mockImplementation(async ({ data }) => ({ id: 'movement', ...data }));
});

describe('cobros de caja opcionales', () => {
  it.each(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'])('omite %s sin configuración compatible sin pedir apertura', async method => {
    mocks.cashRegister.findFirst.mockResolvedValue(null);
    await recordCash(tx, { ...input, method });
    expect(mocks.cashMovement.create).not.toHaveBeenCalled();
    expect(mocks.cashSession.findFirst).not.toHaveBeenCalled();
    if (method !== 'TARJETA') expect(mocks.cashRegister.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { storeId: 'store', currency: 'USD', method, archivedAt: null } }));
  });

  it('registra sin asignar cuando hay configuración sin sesión abierta', async () => {
    mocks.cashRegister.findFirst.mockResolvedValueOnce(box).mockResolvedValueOnce(null);
    await recordCash(tx, input);
    expect(mocks.cashMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ registerId: null, sessionId: null, currency: 'USD', method: 'EFECTIVO', sourceId: 'sale', amount: expect.anything() }) });
    expect(Number(mocks.cashMovement.create.mock.calls[0][0].data.amount)).toBe(50);
    expect(mocks.cashRegister.update).not.toHaveBeenCalled();
  });

  it('asigna sólo a una caja compatible abierta hoy, priorizando la predeterminada', async () => {
    mocks.cashRegister.findFirst.mockResolvedValue(box);
    mocks.cashSession.findFirst.mockResolvedValue({ id: 'today' });
    await recordCash(tx, input);
    expect(mocks.cashRegister.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ currency: 'USD', method: 'EFECTIVO', sessions: { some: { storeId: 'store', day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), status: 'OPEN' } } }) }));
    expect(mocks.cashMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ registerId: 'box', sessionId: 'today', currency: 'USD', method: 'EFECTIVO' }) });
    expect(mocks.cashRegister.update).toHaveBeenCalledWith({ where: { id: 'box' }, data: { balance: { increment: expect.anything() } } });
    expect(Number(mocks.cashRegister.update.mock.calls[0][0].data.balance.increment)).toBe(50);
  });

  it('conserva idempotencia de cobros con requestKey', async () => {
    mocks.cashRegister.findFirst.mockResolvedValue(box);
    mocks.cashMovement.findFirst.mockResolvedValue({ id: 'prior' });
    await recordCash(tx, { ...input, requestKey: 'same' });
    expect(mocks.cashMovement.create).not.toHaveBeenCalled();
  });
});

describe('compensación sin editar el original', () => {
  const original = { id: 'original', storeId: 'store', registerId: null, sessionId: null, currency: 'USD', method: 'EFECTIVO', amount: new Decimal(50), kind: 'COBRO', reversalOf: null, voidedAt: null, sourceType: 'sale', sourceId: 'sale' } as CashMovement;
  it('revierte un movimiento sin asignar aun sin caja configurada activa', async () => {
    mocks.cashMovement.findMany.mockResolvedValue([original]);
    mocks.cashMovement.findFirst.mockResolvedValue(null);
    mocks.cashRegister.findFirst.mockResolvedValue(null);
    await reverseCashSource(tx, 'store', 'sale', 'sale');
    expect(mocks.cashMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ registerId: null, sessionId: null, reversalOf: 'original', amount: new Decimal(-50), currency: 'USD', method: 'EFECTIVO' }) });
    expect(mocks.cashRegister.update).not.toHaveBeenCalled();
  });
  it('mantiene el reintegro fuera de cajas aunque ahora exista una compatible abierta', async () => {
    mocks.cashMovement.findMany.mockResolvedValue([original]);
    mocks.cashRegister.findFirst.mockResolvedValue(box);
    mocks.cashSession.findFirst.mockResolvedValue({ id: 'today' });
    await reverseCashSource(tx, 'store', 'sale', 'sale');
    expect(mocks.cashMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ registerId: null, sessionId: null, reversalOf: original.id, amount: new Decimal(-50), currency: 'USD', method: 'EFECTIVO' }) });
    expect(mocks.cashRegister.findFirst).not.toHaveBeenCalled();
    expect(mocks.cashSession.findFirst).not.toHaveBeenCalled();
    expect(mocks.cashRegister.update).not.toHaveBeenCalled();
  });

  it.each([false, true])('compensa un cobro asignado con caja compatible abierta=%s sin tocar la original', async open => {
    mocks.cashMovement.findMany.mockResolvedValue([{ ...original, registerId: 'closed', sessionId: 'yesterday', currency: null, method: null }]);
    mocks.cashRegister.findFirst.mockResolvedValueOnce({ ...box, id: 'closed' }).mockResolvedValueOnce(open ? box : null);
    mocks.cashSession.findFirst.mockResolvedValue({ id: 'today' });
    await reverseCashSource(tx, 'store', 'sale', 'sale');
    expect(mocks.cashMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ registerId: open ? box.id : null, sessionId: open ? 'today' : null, reversalOf: original.id, amount: new Decimal(-50), currency: 'USD', method: 'EFECTIVO' }) });
    expect(mocks.cashRegister.update).toHaveBeenCalledTimes(open ? 1 : 0);
    if (open) expect(mocks.cashRegister.update).toHaveBeenCalledWith({ where: { id: box.id }, data: { balance: { increment: new Decimal(-50) } } });
  });

  it('no inventa un movimiento cuando el cobro original no tenía configuración de caja', async () => {
    mocks.cashMovement.findMany.mockResolvedValue([]);
    mocks.cashRegister.findFirst.mockResolvedValue(box);
    await reverseCashSource(tx, 'store', 'sale', 'sale');
    expect(mocks.cashMovement.create).not.toHaveBeenCalled();
    expect(mocks.cashRegister.update).not.toHaveBeenCalled();
  });

  it('no vuelve a compensar un original inmutable ya compensado', async () => {
    mocks.cashMovement.findMany.mockResolvedValue([original]);
    mocks.cashMovement.findFirst.mockResolvedValue({ reversalOf: original.id });
    await reverseCashSource(tx, 'store', 'sale', 'sale');
    expect(mocks.cashMovement.create).not.toHaveBeenCalled();
  });
});
