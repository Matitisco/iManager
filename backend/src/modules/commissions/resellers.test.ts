import { describe, expect, it } from 'vitest';
import { resellerName } from './resellers.service.js';
describe('nombre de revendedor', () => {
  it('normaliza espacios y conserva acentos', () => expect(resellerName('  Sofía   Ejemplo ')).toBe('Sofía Ejemplo'));
  it.each([' ', 'a'.repeat(81)])('rechaza nombres inválidos', name => expect(() => resellerName(name)).toThrow());
});
