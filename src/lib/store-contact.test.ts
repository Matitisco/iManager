import { describe, expect, it } from 'vitest';
import { contactSummary, normalizeInstagram, storeContactErrors } from './store-contact';

describe('store contact', () => {
  it('summarizes the saved phone, email and instagram', () => {
    expect(contactSummary({ phone: '2614001122', email: 'hola@tienda.test', instagram: 'mitienda' })).toBe('2614001122 · hola@tienda.test · @mitienda');
    expect(contactSummary({ phone: null, email: null, instagram: null })).toBe('Sin datos de contacto');
  });

  it('normalizes an @usuario or an Instagram URL', () => {
    expect(normalizeInstagram('  @mi.tienda  ')).toBe('mi.tienda');
    expect(normalizeInstagram('https://www.instagram.com/mi.tienda/?hl=es')).toBe('mi.tienda');
    expect(normalizeInstagram('https://instagram.com/@mi.tienda/')).toBe('mi.tienda');
    expect(normalizeInstagram('instagram.com/mi.tienda')).toBe('mi.tienda');
  });

  it('rejects a malformed email or instagram before saving', () => {
    expect(storeContactErrors({ email: 'no-es-correo', instagram: 'mi tienda' })).toEqual({
      email: 'El correo no es válido',
      instagram: 'Usá @usuario o el link del perfil',
    });
    expect(storeContactErrors({ email: 'hola@tienda.test', instagram: '@mi.tienda' })).toEqual({});
    expect(storeContactErrors({ email: '', instagram: 'https://instagram.com/mi.tienda' }, { instagramRequired: true })).toEqual({});
  });

  it('requires instagram when the store form demands it', () => {
    expect(storeContactErrors({ email: '', instagram: '  ' }, { instagramRequired: true })).toEqual({
      instagram: 'Completá el Instagram de la tienda',
    });
    expect(storeContactErrors({ email: '', instagram: '@' }, { instagramRequired: true })).toEqual({
      instagram: 'Completá el Instagram de la tienda',
    });
    expect(storeContactErrors({ email: 'hola@tienda.test', instagram: 'https://example.com/tienda' }, { instagramRequired: true })).toEqual({
      instagram: 'Usá @usuario o el link del perfil',
    });
  });
});
