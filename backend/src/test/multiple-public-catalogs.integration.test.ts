import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { useIntegrationApp } from './integration-helpers.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
const get = (url: string) => getApp().inject({ url, headers });
const post = (payload: Record<string, unknown>) => getApp().inject({ method: 'POST', url: '/api/catalog/list', headers, payload });
const patch = (id: string, payload: Record<string, unknown>) => getApp().inject({ method: 'PATCH', url: `/api/catalog/list/${id}`, headers, payload });
const remove = (id: string) => getApp().inject({ method: 'DELETE', url: `/api/catalog/list/${id}`, headers });
async function fixture() {
  const { store, membership } = await seedStoreContext();
  const { inventoryItem } = await seedCatalogFixture(store!.id);
  await prisma.store.update({ where: { id: store!.id }, data: { currency: 'USD', exchangeMode: 'manual', manualSell: 1300 } });
  await prisma.inventoryItem.update({ where: { id: inventoryItem.id }, data: { catalogVisible: true, currency: 'USD', cost: 100.25, price: 200.25 } });
  const list = await get('/api/catalog/list');
  expect(list.statusCode).toBe(200);
  return { store: store!, membership: membership!, item: inventoryItem, defaultCatalog: list.json().catalogs[0] };
}

describe('multiple public catalogs', () => {
  it('creates independent catalogs, globally unique links, edits and deletes with audit', async () => {
    const { store, defaultCatalog } = await fixture();
    expect(defaultCatalog).toMatchObject({ name: 'Clientes finales', isDefault: true, priceRuleMode: 'LIST_PERCENT', priceAdjustPercent: 0 });
    const a = await post({ name: 'Revendedores', active: true });
    const b = await post({ name: 'Revendedores' });
    expect(a.statusCode).toBe(200); expect(b.statusCode).toBe(200);
    expect(a.json().catalog.slug).not.toBe(b.json().catalog.slug);
    const other = await seedStoreContext({ firebaseUid: 'unique-other', email: 'unique-other@example.com' });
    await expect(prisma.storeCatalog.create({ data: { storeId: other.store!.id, slug: a.json().catalog.slug, name: 'Duplicado' } })).rejects.toMatchObject({ code: 'P2002' });
    const catalog = a.json().catalog;
    expect((await patch(catalog.id, { name: 'Mayoristas', hideReserved: false, priceAdjustPercent: -10 })).json().catalog).toMatchObject({ name: 'Mayoristas', hideReserved: false, priceAdjustPercent: -10 });
    expect((await get('/api/catalog/list')).json().catalogs).toHaveLength(3);
    expect((await remove(defaultCatalog.id)).statusCode).toBe(409);
    expect((await remove(catalog.id)).statusCode).toBe(200);
    expect((await get(`/api/public/catalog/${catalog.slug}`)).statusCode).toBe(404);
    expect(await prisma.auditEvent.count({ where: { storeId: store.id, action: 'catalog.deleted' } })).toBe(1);
    expect((await remove(catalog.id)).statusCode).toBe(404);
    expect((await get('/api/catalog/list')).json().catalogs).toHaveLength(2);
  });
  it('keeps the old link and rules through idempotent SQL backfill and runtime import', async () => {
    const { store } = await seedStoreContext();
    const legacy = await prisma.storePublicCatalog.create({ data: { storeId: store!.id, slug: 'legacy-public-link', active: true, hideReserved: false, minBattery: 73, priceCurrency: 'USD', hours: '9 a 18' } });
    // Execute the INSERT twice against tables created by CI db push.
    const sql = readFileSync(new URL('../../prisma/migrations/20261103210000_multiple_public_catalogs/migration.sql', import.meta.url), 'utf8');
    const backfill = sql.slice(sql.indexOf('INSERT INTO'));
    await prisma.$executeRawUnsafe(backfill);
    await prisma.$executeRawUnsafe(backfill);
    const catalogs = (await get('/api/catalog/list')).json().catalogs;
    expect(catalogs).toHaveLength(1);
    expect(catalogs[0]).toMatchObject({ slug: legacy.slug, name: 'Clientes finales', active: true, hideReserved: false, minBattery: 73, hours: '9 a 18' });
    expect((await get(`/api/public/catalog/${legacy.slug}`)).statusCode).toBe(200);
    await patch(catalogs[0].id, { hours: '10 a 19' });
    expect(await prisma.storePublicCatalog.findUniqueOrThrow({ where: { storeId: store!.id } })).toMatchObject({ hours: '9 a 18' });
  });
  it('serves each rule by slug without exposing private fields or changing OWN visibility', async () => {
    const { item } = await fixture();
    const list = (await post({ name: 'Descuento', active: true, priceAdjustPercent: -10 })).json().catalog;
    const cost = (await post({ name: 'Mayorista', active: true, priceRuleMode: 'COST_PERCENT', priceAdjustPercent: 25 })).json().catalog;
    const manual = (await post({ name: 'Especial', active: true, priceRuleMode: 'MANUAL', manualPrices: [{ inventoryItemId: item.id, price: 123, currency: 'ARS' }] })).json().catalog;
    for (const [catalog, expected, currency] of [[list, 180.23, 'USD'], [cost, 125.31, 'USD'], [manual, 123, 'ARS']] as const) {
      const result = (await get(`/api/public/catalog/${catalog.slug}`)).json();
      expect(result.items[0]).toMatchObject({ price: expected, currency });
      expect(Object.keys(result.items[0]).sort()).toEqual(['model', 'capacity', 'color', 'condition', 'grade', 'batteryHealth', 'price', 'currency'].sort());
      expect(result).not.toHaveProperty('priceRuleMode');
      expect(result.items[0]).not.toHaveProperty('cost');
      expect(result.items[0]).not.toHaveProperty('id');
    }
    await patch(manual.id, { manualPrices: [{ inventoryItemId: item.id, price: null, currency: 'USD' }] });
    expect((await get(`/api/public/catalog/${manual.slug}`)).json().items[0].price).toBe(200.25);
    await patch(cost.id, { showPrice: false });
    expect((await get(`/api/public/catalog/${cost.slug}`)).json().items[0]).not.toHaveProperty('price');
    await getApp().inject({ method: 'PATCH', url: '/api/catalog/items', headers, payload: { ids: [item.id], visible: false } });
    for (const catalog of [list, cost, manual]) expect((await get(`/api/public/catalog/${catalog.slug}`)).json().items).toHaveLength(1);
  });
  it('previews unsaved rules of the chosen catalog without persisting them', async () => {
    const { item } = await fixture();
    const catalog = (await post({ name: 'Vista previa', active: true, priceRuleMode: 'MANUAL', manualPrices: [{ inventoryItemId: item.id, price: 50, currency: 'USD' }] })).json().catalog;
    const preview = await getApp().inject({ method: 'POST', url: '/api/catalog/preview', headers, payload: { catalogId: catalog.id, manualPrices: [{ inventoryItemId: item.id, price: 75, currency: 'USD' }] } });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().items[0].price).toBe(75);
    expect((await get(`/api/public/catalog/${catalog.slug}`)).json().items[0].price).toBe(50);
  });
  it('enforces financial, section and publication permissions, including redaction on legacy endpoints', async () => {
    const { membership, defaultCatalog, item } = await fixture();
    const catalog = (await post({ name: 'Costo privado', active: true, priceRuleMode: 'COST_PERCENT', priceAdjustPercent: 25 })).json().catalog;
    await patch(defaultCatalog.id, { priceRuleMode: 'COST_PERCENT', priceAdjustPercent: 25 });
    await prisma.storeMember.update({ where: { id: membership.id }, data: { role: 'MANAGER', sections: ['publicCatalog'] } });
    const restricted = (await get('/api/catalog/list')).json().catalogs;
    expect(restricted.find((row: { id: string }) => row.id === catalog.id)).toMatchObject({ priceRuleMode: null, priceAdjustPercent: null });
    expect((await get('/api/catalog')).json().catalog.priceRuleMode).toBeNull();
    const visibility = await getApp().inject({ method: 'PATCH', url: '/api/catalog/items', headers, payload: { ids: [item.id], visible: true } });
    expect(visibility.json().catalog.priceRuleMode).toBeNull();
    for (const input of [{ priceRuleMode: 'COST_PERCENT' }, { priceAdjustPercent: 5 }, { active: false }]) expect((await patch(catalog.id, input)).statusCode).toBe(403);
    expect((await post({ name: 'Prohibido', priceRuleMode: 'COST_PERCENT' })).statusCode).toBe(403);
    expect((await getApp().inject({ method: 'POST', url: '/api/catalog/preview', headers, payload: { catalogId: catalog.id, priceRuleMode: 'COST_PERCENT' } })).statusCode).toBe(403);
    const privatePreview = await getApp().inject({ method: 'POST', url: '/api/catalog/preview', headers, payload: { catalogId: catalog.id, hours: 'Vista previa' } });
    expect(privatePreview.statusCode).toBe(200);
    expect(privatePreview.json().items[0].price).toBe(125.31);
    expect(privatePreview.json()).not.toHaveProperty('priceAdjustPercent');
    expect((await remove(catalog.id)).statusCode).toBe(403);
    expect((await patch(catalog.id, { hours: 'Solo cambia el horario' })).statusCode).toBe(200);
    expect((await get(`/api/public/catalog/${catalog.slug}`)).json().items[0].price).toBe(125.31);
    expect((await patch(catalog.id, { priceRuleMode: 'LIST_PERCENT', priceAdjustPercent: 0 })).statusCode).toBe(200);
    await prisma.storeMember.update({ where: { id: membership.id }, data: { sections: [] } });
    expect((await get('/api/catalog/list')).statusCode).toBe(403);
    expect((await patch(catalog.id, { name: 'No' })).statusCode).toBe(403);
  });
  it('keeps the temporary STAFF financial grant coherent with canSeeFinancials', async () => {
    const { membership } = await fixture();
    await prisma.storeMember.update({ where: { id: membership.id }, data: { role: 'STAFF', sections: ['publicCatalog'] } });
    const { canSeeFinancials } = await import('../modules/stores/sections.js');
    const allowed = canSeeFinancials({ role: 'STAFF', sections: ['publicCatalog'] });
    expect((await post({ name: 'Staff', priceRuleMode: 'COST_PERCENT' })).statusCode).toBe(allowed ? 200 : 403);
  });
  it('rejects cross-store edits and manual prices atomically and limits catalogs under concurrency', async () => {
    const { store, item } = await fixture();
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@example.com' });
    const { inventoryItem: foreign } = await seedCatalogFixture(other.store!.id);
    const foreignCatalog = await prisma.storeCatalog.create({ data: { storeId: other.store!.id, name: 'Ajeno', slug: 'other-catalog' } });
    expect((await patch(foreignCatalog.id, { name: 'No' })).statusCode).toBe(404);
    expect((await remove(foreignCatalog.id)).statusCode).toBe(404);
    const catalog = (await post({ name: 'Original' })).json().catalog;
    expect((await patch(catalog.id, { name: 'No debe guardarse', manualPrices: [{ inventoryItemId: item.id, price: 10, currency: 'USD' }, { inventoryItemId: foreign.id, price: 20, currency: 'USD' }] })).statusCode).toBe(404);
    expect(await prisma.storeCatalog.findUniqueOrThrow({ where: { id: catalog.id } })).toMatchObject({ name: 'Original' });
    expect(await prisma.catalogItemPrice.count({ where: { catalogId: catalog.id } })).toBe(0);
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => post({ name: `Lista ${index}` })));
    expect(results.filter(result => result.statusCode === 200)).toHaveLength(8);
    expect(results.filter(result => result.statusCode === 409)).toHaveLength(2);
    expect(await prisma.storeCatalog.count({ where: { storeId: store.id } })).toBe(10);
  });
});
