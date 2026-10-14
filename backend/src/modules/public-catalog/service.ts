import { randomBytes } from 'node:crypto';
import { prisma } from '../../plugins/prisma.js';
import { DomainError } from '../../lib/domain-error.js';
import { currentBlueRate } from '../../lib/blue-rate.js';
import { writeAudit, type Actor } from '../audit/audit.js';
import type { CatalogSettingsInput } from './schema.js';
import { convertCatalogPrice, countAvailable, ruleReason } from './rules.js';

// Deliberate allowlist: never fetch private inventory fields for public sharing.
const itemSelect = { model: true, capacity: true, color: true, condition: true, grade: true, batteryHealth: true, price: true, currency: true, status: true, quantity: true, archivedAt: true, needsCompletion: true } as const;
function newSlug(name: string) {
  const prefix = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'tienda';
  return `${prefix}-${randomBytes(12).toString('hex')}`;
}
export async function getSettings(storeId: string) {
  const config = await prisma.storePublicCatalog.findUnique({ where: { storeId } });
  if (!config) return null;
  const items = await prisma.inventoryItem.findMany({ where: { storeId, archivedAt: null }, select: { ...itemSelect, id: true, catalogVisible: true }, orderBy: [{ model: 'desc' }, { id: 'asc' }] });
  const rows = items.map(item => ({ id: item.id, model: item.model, capacity: item.capacity, color: item.color, condition: item.condition, grade: item.grade, batteryHealth: item.batteryHealth, price: Number(item.price), currency: item.currency, catalogVisible: item.catalogVisible, reason: ruleReason(item, config) ?? (item.catalogVisible ? null : 'Oculto a mano') }));
  return { slug: config.slug, active: config.active, hideWithoutStock: config.hideWithoutStock, hideReserved: config.hideReserved, minBattery: config.minBattery, showPrice: config.showPrice, priceCurrency: config.priceCurrency, logoUrl: config.logoUrl, hours: config.hours, items: rows, counts: { visible: rows.filter(item => !item.reason).length, rules: rows.filter(item => item.reason && item.reason !== 'Oculto a mano').length, manual: rows.filter(item => item.reason === 'Oculto a mano').length, available: countAvailable(items) } };
}
export async function saveSettings(storeId: string, input: CatalogSettingsInput, actor: Actor, regenerate = false) {
  await prisma.$transaction(async tx => {
    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { name: true } });
    await tx.storePublicCatalog.upsert({ where: { storeId }, create: { storeId, slug: newSlug(store.name), ...input }, update: { ...input, ...(regenerate ? { slug: newSlug(store.name) } : {}) } });
    await writeAudit(tx, { storeId, actor, action: regenerate ? 'catalog.regenerated' : 'catalog.settings', entityType: 'catalog', entityId: storeId });
  });
  return getSettings(storeId);
}
export async function setVisibility(storeId: string, ids: string[], visible: boolean, actor: Actor) {
  const unique = [...new Set(ids)];
  await prisma.$transaction(async tx => {
    const count = await tx.inventoryItem.count({ where: { storeId, id: { in: unique }, archivedAt: null } });
    if (count !== unique.length) throw new DomainError('Uno de los equipos no pertenece a esta tienda o ya no está disponible', 404);
    await tx.inventoryItem.updateMany({ where: { storeId, id: { in: unique }, archivedAt: null }, data: { catalogVisible: visible } });
    await writeAudit(tx, { storeId, actor, action: 'catalog.visibility', entityType: 'catalog', entityId: storeId, detail: `${visible ? 'Mostrar' : 'Ocultar'}: ${unique.length} equipos` });
  });
  return getSettings(storeId);
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
  const config = await prisma.storePublicCatalog.findUnique({ where: { slug }, include: { store: { select: { name: true, phone: true, address: true, currency: true, exchangeMode: true, exchangeSource: true, manualSell: true } } } });
  if (!config) return null;
  const store = { name: config.store.name, phone: config.store.phone, address: config.store.address, logoUrl: config.logoUrl, hours: config.hours, currency: config.store.currency };
  if (!config.active) return { store, active: false, showPrice: false, priceCurrency: config.priceCurrency, items: [] };
  const rows = await prisma.inventoryItem.findMany({ where: { storeId: config.storeId, catalogVisible: true, archivedAt: null, needsCompletion: false }, select: itemSelect, orderBy: [{ model: 'desc' }, { capacity: 'asc' }, { color: 'asc' }] });
  const visible = rows.filter(item => !ruleReason(item, config));
  const requiresRate = config.showPrice && config.priceCurrency !== 'ORIGINAL' && visible.some(item => (item.currency ?? config.store.currency) !== config.priceCurrency);
  const rate = requiresRate ? await exchangeRate(config.store) : 1;
  const items = visible.map(item => {
    const currency = config.priceCurrency === 'ORIGINAL' ? (item.currency ?? config.store.currency) : config.priceCurrency;
    return { model: item.model, capacity: item.capacity, color: item.color, condition: item.condition, grade: item.grade, batteryHealth: item.batteryHealth, ...(config.showPrice ? { price: convertCatalogPrice(Number(item.price), item.currency ?? config.store.currency, currency, rate), currency } : {}) };
  });
  return { store, active: true, showPrice: config.showPrice, priceCurrency: config.priceCurrency, items };
}
