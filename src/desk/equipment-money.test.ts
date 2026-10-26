import { expect, it } from 'vitest';
import type { Product } from '../types';
import { commitGroup } from './money';
import { equipmentMoney } from './equipment-money';

const current = { price: 1300000.50, cost: 1000000.25, currency: 'ARS' } as Product;
const commit = (fields: Parameters<typeof commitGroup>[0]) => commitGroup(fields, 'USD', 1300);
it('conserva monto y moneda exactos al editar solo el color de un equipo ARS en tienda USD', () => {
  expect(equipmentMoney(current, '1.000', '769', true, false, commit)).toMatchObject({
    blocked: false, cost: 1000000.25, amounts: [{ amount: 1300000.50, currency: 'ARS' }, { amount: 1000000.25, currency: 'ARS' }],
  });
});
it('guarda costo y precio juntos en la moneda activa al editar un importe', () => {
  expect(equipmentMoney(current, '1.000', '800', true, false, commit)).toMatchObject({
    blocked: false, cost: 800, amounts: [{ amount: 1000, currency: 'USD' }, { amount: 800, currency: 'USD' }],
  });
});
it('conserva costo oculto sin enviarlo como importe convertido', () => {
  expect(equipmentMoney(current, '1.000', '', false, false, commit).cost).toBe(current.cost);
});
