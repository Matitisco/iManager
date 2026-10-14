import { describe, expect, it } from 'vitest';
import { catalogBatteryMinimum, catalogBatteryLabel, catalogDisplayCurrency, catalogPrice, catalogPriceCaption, EMPTY_FILTERS, filterCatalog, whatsappLink } from './presentation';
const items = [
  { model: 'iPhone 15 Pro', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A+', batteryHealth: '90%', price: 920, currency: 'USD' },
  { model: 'iPhone 14', capacity: '256GB', color: 'Azul', condition: 'NUEVO', grade: '', batteryHealth: '100%', price: 650, currency: 'USD' },
];
describe('public price list', () => {
  it('never treats an unknown battery as 100%, and preserves ranges', () => {
    expect(catalogBatteryMinimum('N/A')).toBeNull();
    expect(catalogBatteryLabel('N/A')).toBe('Sin dato');
    expect(catalogBatteryLabel('83-85%')).toBe('83-85%');
    expect(catalogBatteryLabel('0,84')).toBe('84%');
    expect(filterCatalog([{ ...items[0], batteryHealth: 'N/A' }], { ...EMPTY_FILTERS, battery: '80' }, true)).toEqual([]);
  });

  it('combines model, capacity, price, condition, battery and case-insensitive search', () => {
    expect(filterCatalog(items, { ...EMPTY_FILTERS, query: 'negro', model: 'iPhone 15 Pro', capacity: '128GB', condition: 'Usado A+', battery: '85', min: '900', max: '1000' }, true)).toEqual([items[0]]);
    expect(filterCatalog(items, { ...EMPTY_FILTERS, min: '950' }, true)).toEqual([]);
    expect(filterCatalog(items, { ...EMPTY_FILTERS, battery: '95' }, true)).toEqual([items[1]]);
  });
  it('ignores price filters when prices are hidden and says Consultá', () => {
    expect(filterCatalog(items, { ...EMPTY_FILTERS, min: '9999' }, false)).toHaveLength(2);
    expect(catalogPrice({ ...items[0], price: undefined })).toBe('Consultá');
    expect(catalogPrice(items[0])).toBe('US$ 920');
  });
  it('uses one general store contact with a correctly encoded message', () => {
    const link = whatsappLink('+54 9 11 5555-1234', 'Hola, vi tu lista & quiero consultar');
    expect(link).toBe('https://wa.me/5491155551234?text=Hola%2C%20vi%20tu%20lista%20%26%20quiero%20consultar');
    expect(whatsappLink(null, 'Hola')).toBeNull();
    expect(whatsappLink('011 15 5555-1234', 'Hola')).toBe('https://wa.me/5491155551234?text=Hola');
    expect(whatsappLink('2615551234', 'Hola')).toBe('https://wa.me/5492615551234?text=Hola');
    expect(whatsappLink('+598 99 123456', 'Hola')).toBe('https://wa.me/59899123456?text=Hola');
    expect(whatsappLink('5491155551234', 'Hola')).toBe('https://wa.me/5491155551234?text=Hola');
    expect(whatsappLink('+54 11 5555-1234', 'Hola')).toBe('https://wa.me/5491155551234?text=Hola');
    expect(whatsappLink('123123', 'Hola')).toBeNull();
    const waved = whatsappLink('11 5555-1234', 'Hola 👋');
    expect(waved?.startsWith('https://wa.me/5491155551234?text=')).toBe(true);
    expect(waved).not.toContain('api.whatsapp.com');
    expect(waved).toContain(encodeURIComponent('👋'));
    expect(decodeURIComponent(new URL(waved!).searchParams.get('text')!)).toBe('Hola 👋');
  });
  it('prints the configured currency instead of a per-device label', () => {
    expect(catalogDisplayCurrency({ priceCurrency: 'ORIGINAL', currency: 'ARS' })).toBe('ARS');
    expect(catalogDisplayCurrency({ priceCurrency: 'USD', currency: 'ARS' })).toBe('USD');
    expect(catalogPriceCaption({ showPrice: true, priceCurrency: 'ORIGINAL', currency: 'USD' }, new Date('2026-10-14T15:00:00Z'))).toBe('Hoy, 14/10 · precios en USD');
    expect(catalogPriceCaption({ showPrice: false, priceCurrency: 'USD' }, new Date('2026-10-14T15:00:00Z'))).toBe('Hoy, 14/10 · consultá precios');
  });
});
