import { describe, expect, it } from 'vitest';
import { enableSchema } from './schema.js';

const required = { currentKind: 'WHOLESALE', otherStoreName: 'Sucursal Norte ficticia' };

describe('enableSchema', () => {
  it('conserva compatibilidad con el alta sin contacto', () => {
    expect(enableSchema.parse(required)).toEqual(required);
  });
  it('acepta y recorta dirección e Instagram opcionales, incluso vacíos', () => {
    expect(enableSchema.parse({ ...required, otherAddress: ' Calle Ficticia 123 ', otherInstagram: ' @sucursal.ficticia ' })).toEqual({
      ...required, otherAddress: 'Calle Ficticia 123', otherInstagram: '@sucursal.ficticia',
    });
    expect(enableSchema.parse({ ...required, otherAddress: ' ', otherInstagram: ' ' })).toMatchObject({ otherAddress: '', otherInstagram: '' });
  });
  it.each([
    { otherStoreName: '' },
    { otherStoreName: '   ' },
    { otherStoreName: 'a'.repeat(121) },
    { currentKind: '' },
    { currentKind: 'OTHER' },
    { otherAddress: 'a'.repeat(256) },
    { otherInstagram: 'a'.repeat(301) },
    { otherAddress: null },
    { otherInstagram: 123 },
    { otherField: 'ficticio' },
  ])('rechaza campos fuera del contrato: %j', patch => {
    expect(enableSchema.safeParse({ ...required, ...patch }).success).toBe(false);
  });
  it('admite los límites de nombre y contacto', () => {
    expect(enableSchema.safeParse({ ...required, otherStoreName: 'a'.repeat(120), otherAddress: 'a'.repeat(255), otherInstagram: 'a'.repeat(300) }).success).toBe(true);
  });
});
