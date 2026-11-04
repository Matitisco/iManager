import { describe, expect, it } from 'vitest';
import { getFriendlyErrorMessage } from './utils';
import { INPUT_LIMITS, limitedText } from './input-limits';

describe('friendly validation messages', () => {
  it('keeps a spanish api message and never surfaces raw zod json', () => {
    const zod = '[{"code":"too_small","minimum":0,"type":"number","inclusive":false,"message":"Number must be greater than 0"}]';

    expect(getFriendlyErrorMessage(new Error(JSON.stringify({
      error: 'El precio no puede ser negativo',
      message: 'El precio no puede ser negativo',
      fields: { price: 'El precio no puede ser negativo' },
    })), 'No se pudo guardar.')).toBe('El precio no puede ser negativo');

    expect(getFriendlyErrorMessage(new Error(JSON.stringify({
      statusCode: 500,
      error: 'Internal Server Error',
      message: zod,
    })), 'No se pudo guardar.')).toBe('Ocurrió un error en el servidor. Probá de nuevo en unos minutos.');

    expect(getFriendlyErrorMessage(new Error(zod), 'No se pudo guardar.')).toBe('No se pudo guardar.');
    expect(getFriendlyErrorMessage(zod, 'No se pudo guardar.')).not.toContain('too_small');
  });

  it.each([
    '[{"code":"invalid_type","expected":"string","message":"Invalid input: expected string, received undefined","path":["name"]}]',
    '[{"code":"too_small","origin":"number","minimum":0,"inclusive":false,"message":"Too small: expected number to be >0","path":["price"]}]',
    '[{"code":"invalid_value","values":["ARS","USD"],"path":["currency"],"message":"Invalid option: expected one of ARS|USD"}]',
  ])('hides raw Zod 4 issues: %s', raw => {
    expect(getFriendlyErrorMessage(new Error(raw), 'No se pudo guardar.')).toBe('No se pudo guardar.');
  });

  it('rejects empty, long and negative values before they are sent', () => {
    expect(limitedText('nombre', '   ', INPUT_LIMITS.storeName)).toBe('El nombre es obligatorio');
    expect(limitedText('modelo', 'a'.repeat(500), INPUT_LIMITS.model)).toBe('El modelo puede tener hasta 100 caracteres');
    expect(limitedText('nombre', 'a'.repeat(300), INPUT_LIMITS.clientName)).toBe('El nombre puede tener hasta 120 caracteres');
    expect(limitedText('nombre', 'Sucursal Norte', INPUT_LIMITS.storeName)).toBeNull();
  });
});
