import { describe, expect, it } from 'vitest';
import { tabFromHash } from './hash-route';

describe('ruta del escritorio', () => {
  it('abre Plan y facturación aunque Mercado Pago agregue query al hash', () => {
    expect(tabFromHash('#/plan?preapproval_id=pre-1&status=authorized&external_reference=chk-1')).toBe('billing');
    expect(tabFromHash('#/plan')).toBe('billing');
    expect(tabFromHash('#plan?preapproval_id=pre-1')).toBe('billing');
  });
  it('un hash desconocido sigue yendo al inicio', () => {
    expect(tabFromHash('#/no-existe?preapproval_id=pre-1')).toBe('dashboard');
    expect(tabFromHash('')).toBe('dashboard');
  });
});
