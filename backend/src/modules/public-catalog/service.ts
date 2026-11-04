import { Prisma, type StoreCatalog } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';
import { lockTransactionKey } from '../../lib/advisory-lock.js';
import { DomainError } from '../../lib/domain-error.js';
import { currentBlueRate } from '../../lib/blue-rate.js';
import { writeAudit, type Actor } from '../audit/audit.js';
import type { CatalogSettingsInput, CatalogEditInput } from './schema.js';
import { calculateCatalogPrice, countAvailable, itemVisibleInCatalog, ruleReason } from './rules.js';
import { ensureDefaultInTransaction, getDefaultCatalog, newSlug } from './default-catalog.js';

// Private price inputs are used only in calculation. Every response is allowlisted.
const itemSelect = { id: true, model: true, capacity: true, color: true, condition: true, grade: true, batteryHealth: true, price: true, currency: true, status: true, cantidad: true, archivedAt: true, needsCompletion: true, catalogVisible: true } as const;
const storeSelect = { name: true, phone: true, address: true, currency: true, exchangeMode: true, exchangeSource: true, manualSell: true } as const;
const publicItem = (item: { model: string; capacity: string; color: string; condition: string; grade: string; batteryHealth: string }) => ({ model: item.model, capacity: item.capacity, color: item.color, condition: item.condition, grade: item.grade, batteryHealth: item.batteryHealth });

async function catalogData(config: StoreCatalog, publicOnly = false, overrides: CatalogEditInput = {}) {
  const storeRecord = await prisma.store.findUniqueOrThrow({ where: { id: config.storeId }, select: storeSelect });
  const store = { name: storeRecord.name, phone: storeRecord.phone, address: storeRecord.address, logoUrl: config.logoUrl, hours: config.hours, currency: storeRecord.currency };
  if (publicOnly && !config.active) return { store, active: false, showPrice: false, priceCurrency: config.priceCurrency, items: [], counts: { visible: 0, rules: 0, manual: 0, available: 0 } };
  const [rows, savedPrices, savedHidden] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { storeId: config.storeId, kind: "DEVICE", archivedAt: null, ...(publicOnly ? { needsCompletion: false } : {}) }, select: { ...itemSelect, ...(config.priceRuleMode === 'COST_PERCENT' ? { cost: true } : {}) }, orderBy: [{ model: 'desc' }, { capacity: 'asc' }, { color: 'asc' }, { id: 'asc' }] }),
    prisma.catalogItemPrice.findMany({ where: { catalogId: config.id } }),
    config.itemVisibility === 'OWN' ? prisma.catalogItemHidden.findMany({ where: { catalogId: config.id }, select: { inventoryItemId: true } }) : [],
  ]);
  const prices = new Map(savedPrices.map(row => [row.inventoryItemId, { price: row.price, currency: row.currency }]));
  for (const row of overrides.manualPrices ?? []) {
    if (row.price == null) prices.delete(row.inventoryItemId);
    else prices.set(row.inventoryItemId, { price: new Prisma.Decimal(row.price), currency: row.currency });
  }
  const hidden = new Set(overrides.hiddenItemIds ?? savedHidden.map(row => row.inventoryItemId));
  const visible = (item: typeof rows[number]) => itemVisibleInCatalog(config.itemVisibility, item.catalogVisible, hidden.has(item.id));
  const reason = (item: typeof rows[number]) => ruleReason({ ...item, quantity: item.cantidad }, config) ?? (visible(item) ? null : 'Oculto a mano');
  const selected = publicOnly ? rows.filter(item => !reason(item)) : rows;
  const calculated = (item: typeof rows[number], rate: number, target = config.priceCurrency) => calculateCatalogPrice({ mode: config.priceRuleMode, percent: config.priceAdjustPercent, list: item.price, cost: item.cost, currency: item.currency ?? storeRecord.currency, manual: prices.get(item.id), target, rate });
  const requiresRate = (config.showPrice || !publicOnly) && config.priceCurrency !== 'ORIGINAL' && selected.some(item => { const result = calculated(item, 1, 'ORIGINAL'); return result.price != null && result.currency !== config.priceCurrency; });
  const rate = requiresRate ? await exchangeRate(storeRecord) : 1;
  const items = selected.map(item => ({
    ...publicItem(item),
    ...(publicOnly ? {} : { id: item.id, listPrice: item.price?.toNumber() ?? null, listCurrency: item.currency ?? storeRecord.currency, status: item.status, cantidad: item.cantidad, needsCompletion: item.needsCompletion, catalogVisible: visible(item), reason: reason(item), manualPrice: prices.get(item.id)?.price.toNumber() ?? null, manualCurrency: prices.get(item.id)?.currency ?? item.currency ?? storeRecord.currency }),
    ...(!publicOnly || config.showPrice ? calculated(item, rate) : {}),
  }));
  return { store, active: config.active, showPrice: config.showPrice, priceCurrency: config.priceCurrency, items, counts: { visible: rows.filter(item => !reason(item)).length, rules: rows.filter(item => reason(item) && reason(item) !== 'Oculto a mano').length, manual: rows.filter(item => reason(item) === 'Oculto a mano').length, available: countAvailable(rows) } };
}
async function managed(config: StoreCatalog, financials = true) {
  const data = await catalogData(config);
  // A restricted editor sees only the resulting prices, never the cost rule or markup.
  const restricted = !financials && config.priceRuleMode === 'COST_PERCENT';
  return { id: config.id, itemVisibility: config.itemVisibility, name: config.name, isDefault: config.isDefault, slug: config.slug, active: config.active, hideWithoutStock: config.hideWithoutStock, hideReserved: config.hideReserved, minBattery: config.minBattery, showPrice: config.showPrice, priceCurrency: config.priceCurrency, logoUrl: config.logoUrl, hours: config.hours, priceRuleMode: restricted ? null : config.priceRuleMode, priceAdjustPercent: restricted ? null : config.priceAdjustPercent.toNumber(), items: data.items, counts: data.counts };
}
export async function getSettings(storeId: string, financials = true) {
  const config = await getDefaultCatalog(storeId);
  return config ? managed(config, financials) : null;
}
export async function listStoreCatalogs(storeId: string, financials: boolean) {
  await prisma.$transaction(tx => ensureDefaultInTransaction(tx, storeId, true));
  const rows = await prisma.storeCatalog.findMany({ where: { storeId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] });
  return Promise.all(rows.map(config => managed(config, financials)));
}
function assertPricePermission(input: CatalogEditInput, current: StoreCatalog | null, financials: boolean) {
  if (!financials && (input.priceRuleMode === 'COST_PERCENT' || (input.priceAdjustPercent !== undefined && (input.priceRuleMode ?? current?.priceRuleMode) === 'COST_PERCENT'))) throw new DomainError('No tenés permiso para configurar precios sobre costo', 403);
}
export async function editStoreCatalog(storeId: string, id: string | null, input: CatalogEditInput, actor: Actor, permissions = { canChangeActive: true, financials: true }, regenerate = false) {
  const config = await prisma.$transaction(async tx => {
    await lockTransactionKey(tx, `catalog-settings:${storeId}`);
    const current = id ? await tx.storeCatalog.findFirst({ where: { storeId, id } }) : null;
    if (id && !current) throw new DomainError('Catálogo no encontrado', 404);
    assertPricePermission(input, current, permissions.financials);
    if (current && !permissions.canChangeActive && input.active !== undefined && input.active !== current.active) throw new DomainError('Solo el propietario puede cambiar el estado activo del catálogo', 403);
    if (!current && await tx.storeCatalog.count({ where: { storeId } }) >= 10) throw new DomainError('Podés tener hasta 10 catálogos por tienda', 409);
    const { manualPrices, hiddenItemIds, ...settings } = input;
    if (hiddenItemIds && current?.itemVisibility === 'GLOBAL') throw new DomainError('Este catálogo usa visibilidad compartida', 400);
    if (hiddenItemIds) await validateItemIds(tx, storeId, hiddenItemIds);
    if (manualPrices) {
      const ids = [...new Set(manualPrices.map(row => row.inventoryItemId))];
      if (ids.length !== manualPrices.length) throw new DomainError('Hay equipos repetidos', 400);
      if (await tx.inventoryItem.count({ where: { storeId, kind: "DEVICE", id: { in: ids }, archivedAt: null } }) !== ids.length) throw new DomainError('Uno de los equipos no pertenece a esta tienda o ya no está disponible', 404);
    }
    const saved = current
      ? await tx.storeCatalog.update({ where: { id: current.id }, data: { ...settings, ...(regenerate ? { slug: newSlug(current.name) } : {}) } })
      : await tx.storeCatalog.create({ data: { storeId, slug: newSlug(settings.name ?? 'catalogo'), ...settings, itemVisibility: 'OWN' } });
    if (hiddenItemIds) {
      await tx.catalogItemHidden.deleteMany({ where: { catalogId: saved.id } });
      if (hiddenItemIds.length) await tx.catalogItemHidden.createMany({ data: hiddenItemIds.map(inventoryItemId => ({ catalogId: saved.id, inventoryItemId })) });
    }
    for (const row of manualPrices ?? []) {
      if (row.price == null) await tx.catalogItemPrice.deleteMany({ where: { catalogId: saved.id, inventoryItemId: row.inventoryItemId } });
      else await tx.catalogItemPrice.upsert({ where: { catalogId_inventoryItemId: { catalogId: saved.id, inventoryItemId: row.inventoryItemId } }, create: { catalogId: saved.id, ...row, price: row.price }, update: { price: row.price, currency: row.currency } });
    }
    await writeAudit(tx, { storeId, actor, action: regenerate ? 'catalog.regenerated' : current ? 'catalog.settings' : 'catalog.created', entityType: 'catalog', entityId: saved.id, entityLabel: saved.name });
    return saved;
  });
  return managed(config, permissions.financials);
}
export async function createStoreCatalog(storeId: string, input: CatalogEditInput, actor: Actor, permissions: { canChangeActive: boolean; financials: boolean }) {
  // Reserve the non-deletable default even for stores with no previous public link.
  await prisma.$transaction(tx => ensureDefaultInTransaction(tx, storeId, true));
  return editStoreCatalog(storeId, null, input, actor, permissions);
}
export async function deleteStoreCatalog(storeId: string, id: string, actor: Actor) {
  await prisma.$transaction(async tx => {
    await lockTransactionKey(tx, `catalog-settings:${storeId}`);
    const current = await tx.storeCatalog.findFirst({ where: { storeId, id } });
    if (!current) throw new DomainError('Catálogo no encontrado', 404);
    if (current.isDefault) throw new DomainError('El catálogo predeterminado no se puede borrar; podés desactivarlo', 409);
    await tx.storeCatalog.delete({ where: { id } });
    await writeAudit(tx, { storeId, actor, action: 'catalog.deleted', entityType: 'catalog', entityId: id, entityLabel: current.name });
  });
}
export async function saveSettings(storeId: string, input: CatalogSettingsInput, actor: Actor, regenerate = false, { canChangeActive = true, financials = true }: { canChangeActive?: boolean; financials?: boolean } = {}) {
  const previous = await getDefaultCatalog(storeId);
  const config = previous ?? await prisma.$transaction(tx => ensureDefaultInTransaction(tx, storeId, true));
  return editStoreCatalog(storeId, config!.id, input, actor, { canChangeActive: previous ? canChangeActive : true, financials }, regenerate);
}
export async function setVisibility(storeId: string, ids: string[], visible: boolean, actor: Actor, financials = true) {
  const unique = [...new Set(ids)];
  await prisma.$transaction(async tx => {
    const count = await tx.inventoryItem.count({ where: { storeId, kind: "DEVICE", id: { in: unique }, archivedAt: null } });
    if (count !== unique.length) throw new DomainError('Uno de los equipos no pertenece a esta tienda o ya no está disponible', 404);
    await tx.inventoryItem.updateMany({ where: { storeId, kind: "DEVICE", id: { in: unique }, archivedAt: null }, data: { catalogVisible: visible } });
    const noun = unique.length === 1 ? 'equipo' : 'equipos';
    await writeAudit(tx, {
      storeId, actor, action: 'catalog.visibility', entityType: 'catalog', entityId: storeId,
      detail: `${visible ? 'Mostrar' : 'Ocultar'}: ${unique.length} ${noun}`,
      changes: [
        { field: 'catalog', label: 'Catálogo', before: visible ? 'Visible' : 'Oculto', after: visible ? 'Oculto' : 'Visible' },
        { field: 'count', label: 'Equipos', before: null, after: String(unique.length) },
      ],
    });
  });
  return getSettings(storeId, financials);
}
async function validateItemIds(tx: Prisma.TransactionClient, storeId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw new DomainError('Hay equipos repetidos', 400);
  if (await tx.inventoryItem.count({ where: { storeId, kind: "DEVICE", id: { in: unique }, archivedAt: null } }) !== unique.length) throw new DomainError('Uno de los equipos no pertenece a esta tienda o ya no está disponible', 404);
}
export async function setStoreCatalogVisibility(storeId: string, catalogId: string, ids: string[], visible: boolean, actor: Actor, financials: boolean) {
  const config = await prisma.$transaction(async tx => {
    await lockTransactionKey(tx, `catalog-settings:${storeId}`);
    const config = await tx.storeCatalog.findFirst({ where: { id: catalogId, storeId } });
    if (!config) throw new DomainError('Catálogo no encontrado', 404);
    const unique = [...new Set(ids)];
    await validateItemIds(tx, storeId, unique);
    if (config.itemVisibility === 'OWN') {
      if (visible) await tx.catalogItemHidden.deleteMany({ where: { catalogId, inventoryItemId: { in: unique } } });
      else await tx.catalogItemHidden.createMany({ data: unique.map(inventoryItemId => ({ catalogId, inventoryItemId })), skipDuplicates: true });
    } else {
      await tx.inventoryItem.updateMany({ where: { storeId, kind: "DEVICE", id: { in: unique }, archivedAt: null }, data: { catalogVisible: visible } });
    }
    await writeAudit(tx, { storeId, actor, action: 'catalog.visibility', entityType: 'catalog', entityId: catalogId, entityLabel: config.name, detail: `${visible ? 'Mostrar' : 'Ocultar'}: ${unique.length} equipos` });
    return config;
  });
  return managed(config, financials);
}
async function exchangeRate(store: { exchangeMode: string; exchangeSource: string; manualSell: unknown }) {
  if (store.exchangeMode === 'manual') {
    const rate = Number(store.manualSell);
    if (rate > 0 && Number.isFinite(rate)) return rate;
    throw new DomainError('Configurá la cotización de la tienda para convertir precios', 503);
  }
  if (store.exchangeSource === 'blue') return currentBlueRate();
  const source = store.exchangeSource === 'mep' ? 'bolsa' : 'oficial';
  try {
    const response = await fetch(`https://dolarapi.com/v1/dolares/${source}`, { signal: AbortSignal.timeout(8000) });
    const body = await response.json() as { venta?: number };
    if (!response.ok || !body.venta || !Number.isFinite(body.venta) || body.venta <= 0) throw new Error('quote');
    return body.venta;
  } catch { throw new DomainError('No se pudo obtener la cotización de la tienda', 503); }
}

export async function getPublicCatalog(slug: string) {
  let config = await prisma.storeCatalog.findUnique({ where: { slug } });
  if (!config) {
    const legacy = await prisma.storePublicCatalog.findUnique({ where: { slug }, select: { storeId: true } });
    // A regenerated link is never revived from the legacy table.
    if (legacy) { const imported = await getDefaultCatalog(legacy.storeId); if (imported?.slug === slug) config = imported; }
  }
  if (!config) return null;
  const { counts: _counts, ...data } = await catalogData(config, true);
  return data;
}
export async function previewStoreCatalog(storeId: string, catalogId: string | undefined, input: CatalogEditInput, financials: boolean) {
  const current = catalogId ? await prisma.storeCatalog.findFirst({ where: { storeId, id: catalogId } }) : await prisma.$transaction(tx => ensureDefaultInTransaction(tx, storeId, true));
  if (!current) throw new DomainError('Catálogo no encontrado', 404);
  assertPricePermission(input, catalogId ? current : null, financials);
  const { manualPrices: _manual, hiddenItemIds, ...settings } = input;
  if (hiddenItemIds) {
    if (catalogId && current.itemVisibility === 'GLOBAL') throw new DomainError('Este catálogo usa visibilidad compartida', 400);
    await validateItemIds(prisma, storeId, hiddenItemIds);
  }
  const base = catalogId ? current : { ...current, id: 'preview-new', itemVisibility: 'OWN', name: '', hideWithoutStock: true, hideReserved: true, minBattery: null, showPrice: true, priceCurrency: 'ORIGINAL', priceRuleMode: 'LIST_PERCENT', priceAdjustPercent: new Prisma.Decimal(0), logoUrl: null, hours: null };
  const config = { ...base, ...settings, active: true, priceAdjustPercent: new Prisma.Decimal(input.priceAdjustPercent ?? base.priceAdjustPercent) };
  const { counts: _counts, ...data } = await catalogData(config, true, input);
  return data;
}
