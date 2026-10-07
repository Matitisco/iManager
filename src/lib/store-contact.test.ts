import { describe, expect, it } from 'vitest';
import { contactSummary, storeContactErrors } from './store-contact';

describe('store contact', () => {
  it('summarizes the saved phone, email and instagram', () => {
    expect(contactSummary({ phone: '2614001122', email: 'hola@tienda.test', instagram: 'mitienda' })).toBe('2614001122 · hola@tienda.test · @mitienda');
    expect(contactSummary({ phone: null, email: null, instagram: null })).toBe('Sin datos de contacto');
  });

  it('rejects a malformed email or instagram before saving', () => {
    expect(storeContactErrors({ email: 'no-es-correo', instagram: 'mi tienda' })).toEqual({
      email: 'El correo no es válido',
      instagram: 'Usá el usuario de Instagram, sin espacios',
    });
    expect(storeContactErrors({ email: 'hola@tienda.test', instagram: '@mi.tienda' })).toEqual({});
  });
});