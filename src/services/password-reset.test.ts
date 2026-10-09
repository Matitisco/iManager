import { beforeEach, describe, expect, it, vi } from 'vitest';
import { passwordResetErrorMessage, requestPasswordReset } from './password-reset';

const sendPasswordResetEmail = vi.hoisted(() => vi.fn());

vi.mock('firebase/auth', () => ({
  sendPasswordResetEmail,
}));

vi.mock('../firebase', () => ({
  auth: { currentUser: null },
}));

describe('requestPasswordReset', () => {
  beforeEach(() => {
    sendPasswordResetEmail.mockReset();
    vi.unstubAllEnvs();
  });

  it('calls firebase with the trimmed email', async () => {
    sendPasswordResetEmail.mockResolvedValue(undefined);
    await requestPasswordReset('  owner@imanager.test  ');
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({ currentUser: null }, 'owner@imanager.test');
  });

  it('resolves when firebase says the account does not exist', async () => {
    sendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    await expect(requestPasswordReset('missing@imanager.test')).resolves.toBeUndefined();
  });

  it('rethrows network and rate-limit failures', async () => {
    const network = { code: 'auth/network-request-failed' };
    sendPasswordResetEmail.mockRejectedValue(network);
    await expect(requestPasswordReset('owner@imanager.test')).rejects.toBe(network);
  });

  it('does not call firebase in the e2e auth mode', async () => {
    vi.stubEnv('VITE_TEST_AUTH_MODE', 'e2e');
    await requestPasswordReset('owner@imanager.test');
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('rejects an empty email before calling firebase', async () => {
    await expect(requestPasswordReset('   ')).rejects.toMatchObject({ code: 'auth/invalid-email' });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('passwordResetErrorMessage', () => {
  it('maps network, rate limit and invalid email to spanish', () => {
    expect(passwordResetErrorMessage({ code: 'auth/network-request-failed' })).toMatch(/revisá tu conexión/i);
    expect(passwordResetErrorMessage({ code: 'auth/too-many-requests' })).toMatch(/demasiados intentos/i);
    expect(passwordResetErrorMessage({ code: 'auth/invalid-email' })).toMatch(/no es válido/i);
    expect(passwordResetErrorMessage({ code: 'auth/internal-error' })).toMatch(/no pudimos enviar el link/i);
  });
});
