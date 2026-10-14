import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { useIntegrationApp } from './integration-helpers.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
const { getApp } = useIntegrationApp();

async function fixture() {
  const { store, membership } = await seedStoreContext();
  const { inventoryItem } = await seedCatalogFixture(store!.id);
  await prisma.store.update({ where: { id: store!.id }, data: { currency: 'USD', exchangeMode: 'manual', manualSell: 1300 } });
  const response = await getApp().inject({ method: 'PATCH', url: '/api/catalog', headers: buildAuthHeaders(), payload: { active: true, priceCurrency: 'USD' } });
  expect(response.statusCode).toBe(200);
  return { store: store!, membership: membership!, item: inventoryItem, catalog: response.json().catalog };
}
describe('public catalog API', () => {
  it('is opt-in, anonymous, strictly allowlisted and reflects hiding immediately', async () => {
    const { item, catalog } = await fixture();
    const url = `/api/public/catalog/${catalog.slug}`;
    expect((await getApp().inject(url)).json().items).toEqual([]);
    const change = await getApp().inject({ method: 'PATCH', url: '/api/catalog/items', headers: buildAuthHeaders(), payload: { ids: [item.id], visible: true } });
    expect(change.statusCode).toBe(200);
    expect((await getApp().inject({ url: '/api/inventory', headers: buildAuthHeaders() })).json().inventory[0]).toMatchObject({ catalogVisible: true, catalogIncluded: true });
    const publicResponse = await getApp().inject(url);
    expect(publicResponse.headers['cache-control']).toBe('no-store');
    expect(publicResponse.json().items).toHaveLength(1);
    expect(Object.keys(publicResponse.json().items[0]).sort()).toEqual(['model', 'capacity', 'color', 'condition', 'grade', 'batteryHealth', 'price', 'currency'].sort());
    expect(Object.keys(publicResponse.json().store).sort()).toEqual(['name', 'phone', 'address', 'logoUrl', 'hours', 'currency'].sort());
    expect(catalog.counts.available).toBe(1);
    const forbidden = ['cost', 'imei', 'serial', 'supplier', 'provider', 'id', 'storeId', 'customFields', 'taxId', 'legalName'];
    function check(value: unknown) {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) { expect(forbidden).not.toContain(key); check(child); }
    }
    check(publicResponse.json());
    expect(publicResponse.body).not.toContain(item.imei);
    await getApp().inject({ method: 'PATCH', url: '/api/catalog/items', headers: buildAuthHeaders(), payload: { ids: [item.id], visible: false } });
    expect((await getApp().inject(url)).json().items).toEqual([]);
    expect((await getApp().inject({ url: '/api/inventory', headers: buildAuthHeaders() })).json().inventory[0].catalogIncluded).toBe(false);
  });
  it('removes price completely, converts currencies, applies rules and automatic stock transitions', async () => {
    const { item, catalog } = await fixture();
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { catalogVisible: true, currency: 'ARS', price: 130000, batteryHealth: '79-85%' } });
    const url = `/api/public/catalog/${catalog.slug}`;
    const patch = (payload: Record<string, unknown>) => getApp().inject({ method: 'PATCH', url: '/api/catalog', headers: buildAuthHeaders(), payload });
    expect((await getApp().inject(url)).json().items[0]).toMatchObject({ price: 100, currency: 'USD' });
    await patch({ minBattery: 80 });
    expect((await getApp().inject(url)).json().items).toEqual([]);
    await patch({ minBattery: null, showPrice: false });
    const hidden = (await getApp().inject(url)).json().items[0];
    expect(hidden).not.toHaveProperty('price'); expect(hidden).not.toHaveProperty('currency');
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { status: 'RESERVADO' } });
    expect((await getApp().inject(url)).json().items).toEqual([]);
    await patch({ hideReserved: false });
    expect((await getApp().inject(url)).json().items).toHaveLength(1);
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { status: 'VENDIDO' } });
    expect((await getApp().inject({ url: '/api/catalog', headers: buildAuthHeaders() })).json().catalog.counts.available).toBe(0);
    expect((await getApp().inject(url)).json().items).toEqual([]);
    await patch({ hideWithoutStock: false });
    expect((await getApp().inject(url)).json().items).toHaveLength(1);
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { archivedAt: new Date() } });
    expect((await getApp().inject(url)).json().items).toEqual([]);
  });
  it('deactivates, reactivates and revokes the previous link, with audit', async () => {
    const { item, catalog, store } = await fixture();
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { catalogVisible: true } });
    await getApp().inject({ method: 'PATCH', url: '/api/catalog', headers: buildAuthHeaders(), payload: { active: false } });
    expect((await getApp().inject(`/api/public/catalog/${catalog.slug}`)).json()).toMatchObject({ active: false, items: [] });
    await getApp().inject({ method: 'PATCH', url: '/api/catalog', headers: buildAuthHeaders(), payload: { active: true } });
    const next = (await getApp().inject({ method: 'POST', url: '/api/catalog/regenerate', headers: buildAuthHeaders() })).json().catalog;
    expect(next.slug).not.toBe(catalog.slug);
    expect((await getApp().inject(`/api/public/catalog/${catalog.slug}`)).statusCode).toBe(404);
    expect((await getApp().inject(`/api/public/catalog/${next.slug}`)).json().items).toHaveLength(1);
    expect(await prisma.auditEvent.count({ where: { storeId: store.id, action: 'catalog.regenerated' } })).toBe(1);
  });
  it('restricts every management route to OWNER and refuses cross-store bulk writes atomically', async () => {
    const { item, membership } = await fixture();
    const other = await seedStoreContext({ firebaseUid: 'other-owner', email: 'other@example.com' });
    const { inventoryItem: foreign } = await seedCatalogFixture(other.store!.id);
    const response = await getApp().inject({ method: 'PATCH', url: '/api/catalog/items', headers: buildAuthHeaders(), payload: { ids: [item.id, foreign.id], visible: true } });
    expect(response.statusCode).toBe(404);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).catalogVisible).toBe(false);
    for (const role of ['STAFF', 'MANAGER'] as const) {
      await prisma.storeMember.update({ where: { id: membership.id }, data: { role } });
      for (const [method, url, payload] of [['GET', '/api/catalog', undefined], ['PATCH', '/api/catalog', { active: true }], ['POST', '/api/catalog/regenerate', undefined], ['PATCH', '/api/catalog/items', { ids: [item.id], visible: true }]] as const) expect((await getApp().inject({ method, url, headers: buildAuthHeaders(), payload })).statusCode).toBe(403);
    }
    expect((await getApp().inject('/api/catalog')).statusCode).toBe(401);
  });
  it('rate limits anonymous reads even with spoofed proxy headers, and offers no export or writes', async () => {
    const { catalog } = await fixture();
    const url = `/api/public/catalog/${catalog.slug}`;
    for (let index = 0; index < 60; index++) expect((await getApp().inject({ url, headers: { 'x-forwarded-for': `10.0.0.${index}` } })).statusCode).toBe(200);
    const limited = await getApp().inject(url);
    expect(limited.statusCode).toBe(429); expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['cache-control']).toBe('no-store');
    expect((await getApp().inject({ url, remoteAddress: '127.0.0.2' })).statusCode).toBe(200);
    for (const method of ['POST', 'PATCH', 'DELETE'] as const) expect((await getApp().inject({ method, url })).statusCode).toBe(404);
    expect((await getApp().inject(`${url}/export`)).statusCode).toBe(404);
  });
  it('serves a PNG preview without authentication', async () => {
    const { catalog } = await fixture();
    const response = await getApp().inject(`/api/public/catalog/${catalog.slug}/preview.png`);
    expect(response.statusCode).toBe(200); expect(response.headers['content-type']).toBe('image/png');
    expect(response.rawPayload.subarray(1, 4).toString()).toBe('PNG');
  });
});
