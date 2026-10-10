import { describe, expect, it } from 'vitest';
import { authActionErrorMessage } from './auth-action-errors';

describe('authActionErrorMessage', () => {
  it('maps expired, used, weak and offline errors to spanish', () => {
    expect(authActionErrorMessage({ code: 'auth/expired-action-code' })).toMatch(/venció/i);
    expect(authActionErrorMessage({ code: 'auth/invalid-action-code' })).toMatch(/ya fue usado/i);
    expect(authActionErrorMessage({ code: 'auth/weak-password' })).toMatch(/demasiado débil/i);
    expect(authActionErrorMessage({ code: 'auth/network-request-failed' })).toMatch(/revisá tu conexión/i);
  });

  it('uses a generic spanish message for unknown failures', () => {
    expect(authActionErrorMessage({ code: 'auth/internal-error' })).toMatch(/no pudimos completar la acción/i);
    expect(authActionErrorMessage(new Error('boom'))).toMatch(/no pudimos completar la acción/i);
  });
});
