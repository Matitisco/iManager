import { describe, expect, it } from 'vitest';
import { batteryMinimum, convertCatalogPrice, ruleReason } from './rules.js';
import { settingsSchema } from './schema.js';
import { catalogPreviewPng, escapeXml } from './preview.js';
import sharp from 'sharp';

const config = { hideWithoutStock: true, hideReserved: true, minBattery: 80 };
const item = { status: 'DISPONIBLE', quantity: 1, batteryHealth: '90%' };
describe('catalog rules', () => {
  it.each([['83-85%', 83], ['0.84', 84], ['0,84', 84], ['1', 100], ['100%', 100], ['0%', 0], ['N/A', null], ['', null]])('parses minimum battery %s', (value, expected) => expect(batteryMinimum(value)).toBe(expected));
  it('applies each rule and excludes unknown batteries when a minimum is set', () => {
    expect(ruleReason(item, config)).toBeNull();
    for (const data of [{ status: 'VENDIDO' }, { quantity: 0 }, { status: 'RESERVADO' }, { batteryHealth: '79-85%' }, { batteryHealth: 'N/A' }, { needsCompletion: true }, { archivedAt: new Date() }]) expect(ruleReason({ ...item, ...data }, config)).not.toBeNull();
    expect(ruleReason({ ...item, status: 'RESERVADO', quantity: 0, batteryHealth: 'N/A' }, { hideWithoutStock: false, hideReserved: false, minBattery: null })).toBeNull();
  });
  it('converts prices in either direction and rounds cents', () => {
    expect(convertCatalogPrice(130000, 'ARS', 'USD', 1300)).toBe(100);
    expect(convertCatalogPrice(100, 'USD', 'ARS', 1300)).toBe(130000);
    expect(convertCatalogPrice(1200, 'USD', 'USD', 1300)).toBe(1200);
  });
  it('rejects unknown settings and unsafe logo URLs', () => {
    expect(settingsSchema.safeParse({ minBattery: 101 }).success).toBe(false);
    expect(settingsSchema.safeParse({ cost: 10 }).success).toBe(false);
    expect(settingsSchema.safeParse({ logoUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(settingsSchema.safeParse({ logoUrl: 'https://example.com/logo.png' }).success).toBe(true);
  });
  it('renders a 1200x630 PNG from escaped public model names', async () => {
    expect(escapeXml('<&"')).toBe('&lt;&amp;&quot;');
    const png = await catalogPreviewPng({ store: { name: 'Tienda <&>', phone: null, address: null, logoUrl: null, hours: null }, active: true, showPrice: false, priceCurrency: 'USD', items: [{ model: 'iPhone <15>', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%' }] });
    const metadata = await sharp(png).metadata();
    expect([metadata.width, metadata.height, metadata.format]).toEqual([1200, 630, 'png']);
  });
});
