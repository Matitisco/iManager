import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { createSale, deleteSale, importSales, updateSale, type SaleInput } from '../modules/sales/sales.service.js';
import { seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

useIntegrationApp();

async function fixture(storeCurrency = 'USD', balanceCurrency: string | null = 'USD') {
  const context = await seedStoreContext();
  const storeId = context.store!.id;
  await prisma.store.update({ where: { id: storeId }, data: {
    currency: storeCurrency, exchangeMode: 'manual', manualSell: 1000,
  } });
  const client = await prisma.client.create({ data: { storeId, name: 'Cliente ficticio W401', balanceCurrency } });
  const sale = (patch: Partial<SaleInput> = {}) => createSale(storeId, {
    clientId: client.id, date: '04/11/2026', deviceLabel: 'Equipo ficticio', amount: 500310,
    amountCurrency: 'ARS', exchangeRate: 1000, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', ...patch,
  });
  const spent = async (id = client.id) => Number((await prisma.client.findUniqueOrThrow({ where: { id } })).totalSpent);
  return { storeId, client, sale, spent };
}

describe('totalSpent de ventas directas en moneda del cliente', () => {
  it.each([
    ['USD', 'USD', 'ARS', 500310, 500.31],
    ['USD', 'ARS', 'USD', 500.31, 500310],
    ['ARS', 'USD', 'ARS', 500310, 500.31],
    ['USD', 'USD', 'USD', 500.31, 500.31],
    ['ARS', 'ARS', 'ARS', 500310.31, 500310.31],
    ['USD', null, 'ARS', 500310, 500.31],
    ['ARS', null, 'USD', 500.31, 500310],
  ] as const)('tienda %s, cliente %s, venta %s %s → %s', async (store, balance, currency, amount, expected) => {
    const f = await fixture(store, balance);
    await prisma.client.update({ where: { id: f.client.id }, data: { totalSpent: 10.23 } });
    const sale = await f.sale({ amount, amountCurrency: currency });
    expect(sale).toMatchObject({ amount, amountCurrency: currency, exchangeRate: 1000 });
    expect(await f.spent()).toBe(expected + 10.23);
  });

  it('recalcula una mezcla de monedas con cada cotización histórica y excluye anuladas, borradas y otras tiendas', async () => {
    const f = await fixture();
    const first = await f.sale();
    const second = await f.sale({ amount: 600372, exchangeRate: 1200, status: 'PENDIENTE' });
    await f.sale({ amount: 2.13, amountCurrency: 'USD' });
    await f.sale({ status: 'CANCELADA' });
    const voided = await f.sale();
    await prisma.sale.update({ where: { id: voided.id }, data: { voidedAt: new Date() } });
    const other = await seedStoreContext({ firebaseUid: 'w401-other', email: 'other-w401@imanager.test' });
    await createSale(other.store!.id, { date: '04/11/2026', deviceLabel: 'Otra tienda', amount: 999999,
      amountCurrency: 'USD', exchangeRate: 1000, paymentMethod: 'EFECTIVO', status: 'COMPLETADA' });
    await prisma.store.update({ where: { id: f.storeId }, data: { manualSell: 9000 } });
    await updateSale(f.storeId, first.id, { date: '03/11/2026' });
    expect(await f.spent()).toBe(1002.75);
    await updateSale(f.storeId, second.id, { amount: 720372, amountCurrency: 'ARS' });
    expect(await f.spent()).toBe(1102.75);
    await deleteSale(f.storeId, first.id);
    expect(await f.spent()).toBe(602.44);
    const client = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
    expect(client.lastPurchaseAt?.toISOString()).toBe(second.soldAt);
  });

  it('recalcula si sólo cambia la cotización o la moneda, y al reasignar o cancelar una venta', async () => {
    const f = await fixture();
    const sale = await f.sale();
    await updateSale(f.storeId, sale.id, { exchangeRate: 1200 });
    expect(await f.spent()).toBe(416.93);
    await updateSale(f.storeId, sale.id, { amountCurrency: 'USD' });
    expect(await f.spent()).toBe(500310);
    const next = await prisma.client.create({ data: { storeId: f.storeId, name: 'Cuenta ARS ficticia', balanceCurrency: 'ARS' } });
    await updateSale(f.storeId, sale.id, { clientId: next.id });
    expect(await f.spent()).toBe(0);
    expect(await f.spent(next.id)).toBe(600372000);
    await updateSale(f.storeId, sale.id, { status: 'CANCELADA' });
    expect(await f.spent(next.id)).toBe(0);
  });

  it('conserva el legado sin moneda/cotización cuando no necesita convertir', async () => {
    const f = await fixture('USD', null);
    const sale = await f.sale({ amount: 500.31, amountCurrency: 'USD' });
    await prisma.sale.update({ where: { id: sale.id }, data: { amountCurrency: null, exchangeRate: null } });
    await updateSale(f.storeId, sale.id, { date: '03/11/2026' });
    expect(await f.spent()).toBe(500.31);
    await deleteSale(f.storeId, sale.id);
    expect(await f.spent()).toBe(0);
  });

  it('revierte la edición si falta la cotización histórica de otra venta que necesita conversión', async () => {
    const f = await fixture();
    const first = await f.sale();
    const second = await f.sale({ amount: 10, amountCurrency: 'USD' });
    await prisma.sale.update({ where: { id: first.id }, data: { exchangeRate: null } });
    await expect(updateSale(f.storeId, second.id, { amount: 20, amountCurrency: 'USD' })).rejects.toMatchObject({
      statusCode: 400, message: 'Revisá la cotización antes de confirmar',
    });
    expect(await f.spent()).toBe(510.31);
    expect(Number((await prisma.sale.findUniqueOrThrow({ where: { id: second.id } })).amount)).toBe(10);
  });

  it.each(['USD', 'ARS'])('importa y recalcula sin convertir dos veces para un cliente %s', async balance => {
    const f = await fixture('USD', balance);
    const result = await importSales(f.storeId, [{ clientName: f.client.name, date: '04/11/2026',
      device: 'Equipo importado ficticio', amount: '500310', currency: 'ARS', exchangeRate: 1000 }]);
    expect(result).toMatchObject({ imported: 1, errors: [] });
    const sale = await prisma.sale.findFirstOrThrow({ where: { storeId: f.storeId } });
    expect(Number(sale.amount)).toBe(500.31);
    expect(sale.amountCurrency).toBe('USD');
    const expected = balance === 'USD' ? 500.31 : 500310;
    expect(await f.spent()).toBe(expected);
    await updateSale(f.storeId, sale.id, { date: '03/11/2026' });
    expect(await f.spent()).toBe(expected);
  });
});
