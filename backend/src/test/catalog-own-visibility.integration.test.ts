import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { useIntegrationApp } from './integration-helpers.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
const get = (url: string) => getApp().inject({ url, headers });
const create = (payload: Record<string, unknown>) => getApp().inject({ method: 'POST', url: '/api/catalog/list', headers, payload });
const visibility = (id: string, ids: string[], visible: boolean) => getApp().inject({ method: 'PATCH', url: `/api/catalog/list/${id}/items`, headers, payload: { ids, visible } });
const preview = (payload: Record<string, unknown>) => getApp().inject({ method: 'POST', url: '/api/catalog/preview', headers, payload });

async function fixture() {
  const { store, membership } = await seedStoreContext();
  const { inventoryItem } = await seedCatalogFixture(store!.id);
  const data = { storeId: store!.id, model: 'Otro equipo ficticio', capacity: '64GB', color: 'Azul', condition: 'USADO', grade: 'B', batteryHealth: '85%', cost: 100, price: 200, status: 'DISPONIBLE' };
  const other = await prisma.inventoryItem.create({ data });
  const legacy = await prisma.storeCatalog.create({ data: { storeId: store!.id, name: 'Histórico', slug: 'historico-falso', active: true, isDefault: true } });
  return { store: store!, membership: membership!, item: inventoryItem, other, data, legacy };
}

describe('OWN catalog visibility and inventory membership', () => {
  it('creates OWN fully visible in admin/public and includes inventory added afterwards', async () => {
    const { item, data, legacy } = await fixture();
    const response = await create({ name: 'Lista nueva', active: true });
    expect(response.statusCode).toBe(200);
    const catalog = response.json().catalog;
    expect(catalog).toMatchObject({ itemVisibility: 'OWN', counts: { visible: 2, manual: 0, rules: 0 } });
    expect(catalog.items.every((row: { catalogVisible: boolean; reason: string | null }) => row.catalogVisible && row.reason === null)).toBe(true);
    expect((await get(`/api/public/catalog/${catalog.slug}`)).json().items).toHaveLength(2);
    expect(await prisma.catalogItemHidden.count()).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).catalogVisible).toBe(false);
    expect((await get(`/api/public/catalog/${legacy.slug}`)).json().items).toHaveLength(0);
    const added = await getApp().inject({ method: 'POST', url: '/api/inventory', headers, payload: { ...data, storeId: undefined, model: 'Equipo cargado después' } });
    expect(added.statusCode).toBe(201);
    expect(added.json().inventoryItem).toMatchObject({ catalogVisible: false, catalogIncluded: true, catalogNames: ['Lista nueva'] });
    expect((await get(`/api/public/catalog/${catalog.slug}`)).json().items).toHaveLength(3);
  });

  it('hides/shows only in A, preserving B and GLOBAL, audits and cascades on deletion', async () => {
    const { item, legacy, store } = await fixture();
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { catalogVisible: true } });
    const a = (await create({ name: 'A', active: true })).json().catalog;
    const b = (await create({ name: 'B', active: true })).json().catalog;
    for (let attempt = 0; attempt < 2; attempt++) expect((await visibility(a.id, [item.id], false)).statusCode).toBe(200);
    expect(await prisma.catalogItemHidden.count({ where: { catalogId: a.id } })).toBe(1);
    const admin = (await get('/api/catalog/list')).json().catalogs.find((row: { id: string }) => row.id === a.id);
    expect(admin.counts).toMatchObject({ visible: 1, manual: 1, rules: 0 });
    expect(admin.items.find((row: { id: string }) => row.id === item.id)).toMatchObject({ catalogVisible: false, reason: 'Oculto a mano' });
    expect((await get(`/api/public/catalog/${a.slug}`)).json().items).toHaveLength(1);
    expect((await get(`/api/public/catalog/${b.slug}`)).json().items).toHaveLength(2);
    expect((await get(`/api/public/catalog/${legacy.slug}`)).json().items).toHaveLength(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).catalogVisible).toBe(true);
    expect(await prisma.auditEvent.count({ where: { storeId: store.id, entityId: a.id, action: 'catalog.visibility' } })).toBe(2);
    expect((await visibility(a.id, [item.id], true)).json().catalog.counts.manual).toBe(0);
    await visibility(a.id, [item.id], false);
    expect((await getApp().inject({ method: 'DELETE', url: `/api/catalog/list/${a.id}`, headers })).statusCode).toBe(200);
    expect(await prisma.catalogItemHidden.count({ where: { catalogId: a.id } })).toBe(0);
  });

  it('retains GLOBAL visibility exactly and global switches leave OWN untouched', async () => {
    const { item, other, legacy, store } = await fixture();
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { catalogVisible: true } });
    const globalB = await prisma.storeCatalog.create({ data: { storeId: store.id, name: 'Otro histórico', slug: 'otro-historico', active: true } });
    const own = (await create({ name: 'Nuevo', active: true })).json().catalog;
    for (const catalog of [legacy, globalB]) {
      expect(catalog.itemVisibility).toBe('GLOBAL');
      const admin = (await get('/api/catalog/list')).json().catalogs.find((row: { id: string }) => row.id === catalog.id);
      expect(admin.items.find((row: { id: string }) => row.id === item.id).catalogVisible).toBe(true);
      expect(admin.items.find((row: { id: string }) => row.id === other.id).catalogVisible).toBe(false);
      expect((await get(`/api/public/catalog/${catalog.slug}`)).json().items).toHaveLength(1);
    }
    expect((await visibility(globalB.id, [item.id], false)).statusCode).toBe(200);
    for (const catalog of [legacy, globalB]) expect((await get(`/api/public/catalog/${catalog.slug}`)).json().items).toHaveLength(0);
    expect((await get(`/api/public/catalog/${own.slug}`)).json().items).toHaveLength(2);
  });

  it('creates with hiddenItemIds atomically, previews unsaved exceptions and replaces/clears them', async () => {
    const { item, other } = await fixture();
    const draft = { name: 'Borrador', active: true, hiddenItemIds: [item.id] };
    const before = await prisma.storeCatalog.count();
    const unsaved = await preview(draft);
    expect(unsaved.statusCode).toBe(200);
    expect(unsaved.json().items.map((row: { model: string }) => row.model)).toEqual([other.model]);
    expect(await prisma.storeCatalog.count()).toBe(before);
    const catalog = (await create(draft)).json().catalog;
    expect(catalog.counts).toMatchObject({ visible: 1, manual: 1 });
    const changed = await preview({ catalogId: catalog.id, hiddenItemIds: [other.id] });
    expect(changed.json().items.map((row: { model: string }) => row.model)).toEqual([item.model]);
    expect((await get(`/api/public/catalog/${catalog.slug}`)).json().items.map((row: { model: string }) => row.model)).toEqual([other.model]);
    const edit = (hiddenItemIds: string[]) => getApp().inject({ method: 'PATCH', url: `/api/catalog/list/${catalog.id}`, headers, payload: { hiddenItemIds } });
    expect((await edit([other.id])).json().catalog.counts.manual).toBe(1);
    expect((await edit([])).json().catalog.counts).toMatchObject({ visible: 2, manual: 0 });
  });

  it('keeps stock, reserved, battery and incomplete rules ahead of manual hiding in OWN', async () => {
    const { store, data, item } = await fixture();
    const variations = [{ status: 'RESERVADO' }, { status: 'VENDIDO' }, { cantidad: 0 }, { batteryHealth: '70%' }, { needsCompletion: true }, { archivedAt: new Date() }];
    for (const value of variations) await prisma.inventoryItem.create({ data: { ...data, ...value, storeId: store.id } });
    const response = await create({ name: 'Con reglas', active: true, minBattery: 80, hiddenItemIds: [item.id] });
    expect(response.json().catalog.counts).toMatchObject({ visible: 1, manual: 1, rules: 5 });
    expect((await get(`/api/public/catalog/${response.json().catalog.slug}`)).json().items).toHaveLength(1);
  });

  it('validates tenants, duplicates, limit, unknown mode and section permission with no partial writes', async () => {
    const { item, membership, legacy } = await fixture();
    const other = await seedStoreContext({ firebaseUid: 'other-owner', email: 'other@example.com' });
    const { inventoryItem: foreign } = await seedCatalogFixture(other.store!.id);
    const foreignCatalog = await prisma.storeCatalog.create({ data: { storeId: other.store!.id, slug: 'foreign-fake', itemVisibility: 'OWN' } });
    const catalog = (await create({ name: 'Propio' })).json().catalog;
    expect((await visibility(catalog.id, [item.id, foreign.id], false)).statusCode).toBe(404);
    expect((await visibility(foreignCatalog.id, [item.id], false)).statusCode).toBe(404);
    expect((await create({ name: 'No guardado', hiddenItemIds: [item.id, foreign.id] })).statusCode).toBe(404);
    expect((await preview({ hiddenItemIds: [foreign.id] })).statusCode).toBe(404);
    expect((await create({ name: 'Repetido', hiddenItemIds: [item.id, item.id] })).statusCode).toBe(400);
    expect((await create({ name: 'Modo inyectado', itemVisibility: 'GLOBAL' })).statusCode).toBe(400);
    expect((await create({ name: 'Excesivo', hiddenItemIds: Array(501).fill(item.id) })).statusCode).toBe(400);
    expect((await visibility(catalog.id, Array(501).fill(item.id), false)).statusCode).toBe(400);
    expect((await getApp().inject({ method: 'PATCH', url: `/api/catalog/list/${legacy.id}`, headers, payload: { hiddenItemIds: [item.id] } })).statusCode).toBe(400);
    expect(await prisma.catalogItemHidden.count()).toBe(0);
    await prisma.storeMember.update({ where: { id: membership.id }, data: { role: 'MANAGER', sections: [] } });
    expect((await visibility(catalog.id, [item.id], false)).statusCode).toBe(403);
    await prisma.storeMember.update({ where: { id: membership.id }, data: { sections: ['publicCatalog'] } });
    expect((await visibility(catalog.id, [item.id], false)).statusCode).toBe(200);
  });

  it('returns real names in paginated/full inventory and detail, ignoring paused catalogs and applying rules', async () => {
    const { item, other, legacy } = await fixture();
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { catalogVisible: true } });
    const a = (await create({ name: 'A', active: true })).json().catalog;
    const b = (await create({ name: 'B', active: true, minBattery: 90 })).json().catalog;
    await create({ name: 'Pausado', active: false });
    await visibility(a.id, [item.id], false);
    for (const url of ['/api/inventory?skip=0&take=1&model=iPhone%2014', '/api/inventory']) {
      const response = await get(url);
      expect(response.statusCode).toBe(200);
      expect((response.json().inventory ?? response.json().items).find((row: { id: string }) => row.id === item.id)).toMatchObject({ catalogNames: [legacy.name, b.name], catalogIncluded: true });
    }
    const single = (await get(`/api/inventory?skip=0&take=1&model=${encodeURIComponent(other.model)}`)).json().items[0];
    expect(single).toMatchObject({ catalogNames: ['A'], catalogIncluded: true });
    expect((await get(`/api/inventory/${item.id}`)).json().inventoryItem).toMatchObject({ catalogNames: [legacy.name, b.name], catalogIncluded: true });
    await visibility(a.id, [other.id], false);
    expect((await get(`/api/inventory?skip=0&take=1&model=${encodeURIComponent(other.model)}`)).json().items[0]).toMatchObject({ catalogNames: [], catalogIncluded: false });
  });

  it('queries active catalogs once and hidden rows only for the page ids', async () => {
    const { item, other } = await fixture();
    const catalog = (await create({ name: 'OWN', active: true })).json().catalog;
    await visibility(catalog.id, [other.id], false);
    const catalogsQuery = vi.spyOn(prisma.storeCatalog, 'findMany');
    const hiddenQuery = vi.spyOn(prisma.catalogItemHidden, 'findMany');
    try {
      const response = await get('/api/inventory?skip=0&take=1&model=iPhone%2014');
      expect(response.statusCode).toBe(200);
      expect(catalogsQuery).toHaveBeenCalledTimes(1);
      expect(hiddenQuery).toHaveBeenCalledTimes(1);
      expect(hiddenQuery).toHaveBeenCalledWith(expect.objectContaining({ where: {
        catalogId: { in: [catalog.id] }, inventoryItemId: { in: [item.id] },
      } }));
    } finally {
      catalogsQuery.mockRestore(); hiddenQuery.mockRestore();
    }
  });

  it('applies the additive migration twice without mutating existing catalog/item data', async () => {
    const { item, legacy } = await fixture();
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    const sql = readFileSync(new URL('../../prisma/migrations/20261103230000_catalog_own_visibility/migration.sql', import.meta.url), 'utf8');
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const statement of sql.split(';').filter(value => value.trim())) await prisma.$executeRawUnsafe(statement);
    }
    expect(await prisma.storeCatalog.findUniqueOrThrow({ where: { id: legacy.id } })).toEqual(legacy);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(before);
  });
});
