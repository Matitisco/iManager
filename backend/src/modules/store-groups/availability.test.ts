import { describe, expect, it } from 'vitest';
import { assertTransferAvailable } from './availability.js';
import { balanceQuery, enableSchema, transferSchema } from './schema.js';
const item = {
  status: 'DISPONIBLE',
  archivedAt: null,
  reservedDepositId: null,
  pendingSaleRegistration: false,
  cantidad: 5,
  imei: null,
};
describe('validación de transferencia', () => {
  it('permite unidades restantes de una fila sin IMEI con ventas históricas', () => {
    expect(() => assertTransferAvailable(item, 3, false, true)).not.toThrow();
  });
  it.each([
    { status: 'VENDIDO' },
    { status: 'EN_CONSIGNACION' },
    { status: 'EN_REVISION' },
    { archivedAt: new Date() },
    { reservedDepositId: 'deposit' },
    { pendingSaleRegistration: true },
  ])('rechaza inventario no disponible %j', (patch) => {
    expect(() =>
      assertTransferAvailable({ ...item, ...patch }, 1, false, false),
    ).toThrow();
  });
  it('valida cantidad, consignaciones pendientes y venta del IMEI', () => {
    for (const quantity of [0, -1, 1.5, 6])
      expect(() =>
        assertTransferAvailable(item, quantity, false, false),
      ).toThrow();
    expect(() => assertTransferAvailable(item, 1, true, false)).toThrow();
    expect(() =>
      assertTransferAvailable({ ...item, imei: '123' }, 1, false, true),
    ).toThrow();
    expect(() =>
      assertTransferAvailable({ ...item, imei: '123' }, 2, false, false),
    ).toThrow();
  });
  it('valida contratos y rechaza repetidos, cantidades inválidas y períodos no admitidos', () => {
    expect(balanceQuery.parse({}).months).toBe(6);
    for (const months of ['1', '4', '0', '6.5'])
      expect(balanceQuery.safeParse({ months }).success).toBe(false);
    expect(
      enableSchema.safeParse({ currentKind: 'RETAIL', otherStoreName: ' ' })
        .success,
    ).toBe(false);
    const entry = { inventoryItemId: 'a', quantity: 1 };
    expect(
      transferSchema.safeParse({ toStoreId: 'b', items: [entry, entry] })
        .success,
    ).toBe(false);
    expect(
      transferSchema.safeParse({
        toStoreId: 'b',
        items: [{ ...entry, quantity: 0 }],
      }).success,
    ).toBe(false);
    expect(
      transferSchema.safeParse({
        toStoreId: 'b',
        items: [entry],
        requestKey: 'x'.repeat(81),
      }).success,
    ).toBe(false);
  });
});
