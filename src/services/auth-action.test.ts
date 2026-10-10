import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authActionErrorMessage, confirmReset, recoverEmailCode, verifyEmailCode, verifyResetCode } from './auth-action';

const verifyPasswordResetCode = vi.hoisted(() => vi.fn());
const confirmPasswordReset = vi.hoisted(() => vi.fn());
const applyActionCode = vi.hoisted(() => vi.fn());
const checkActionCode = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ currentUser: null }));

vi.mock('firebase/auth', () => ({
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  checkActionCode,
}));

vi.mock('../firebase', () => ({
  auth,
}));

describe('auth action sdk', () => {
  beforeEach(() => {
    verifyPasswordResetCode.mockReset();
    confirmPasswordReset.mockReset();
    applyActionCode.mockReset();
    checkActionCode.mockReset();
    vi.unstubAllEnvs();
  });

  it('verifies and confirms a password reset through firebase', async () => {
    verifyPasswordResetCode.mockResolvedValue('owner@imanager.test');
    confirmPasswordReset.mockResolvedValue(undefined);

    await expect(verifyResetCode('code-1')).resolves.toBe('owner@imanager.test');
    await confirmReset('code-1', 'nueva-clave-1');

    expect(verifyPasswordResetCode).toHaveBeenCalledWith(auth, 'code-1');
    expect(confirmPasswordReset).toHaveBeenCalledWith(auth, 'code-1', 'nueva-clave-1');
  });

  it('applies verifyEmail and restores recoverEmail through firebase', async () => {
    applyActionCode.mockResolvedValue(undefined);
    checkActionCode.mockResolvedValue({ data: { email: 'old@imanager.test' } });

    await verifyEmailCode('mail-code');
    await expect(recoverEmailCode('mail-code')).resolves.toBe('old@imanager.test');

    expect(checkActionCode).toHaveBeenCalledWith(auth, 'mail-code');
    expect(applyActionCode).toHaveBeenCalledTimes(2);
    expect(applyActionCode).toHaveBeenCalledWith(auth, 'mail-code');
  });

  it('uses the in-app mock instead of the sdk in e2e mode', async () => {
    vi.stubEnv('VITE_TEST_AUTH_MODE', 'e2e');

    await expect(verifyResetCode('valid-code')).resolves.toBe('owner@imanager.test');
    await expect(confirmReset('weak', 'nueva-clave-1')).rejects.toMatchObject({ code: 'auth/weak-password' });
    await expect(verifyResetCode('expired')).rejects.toMatchObject({ code: 'auth/expired-action-code' });
    await expect(verifyResetCode('used')).rejects.toMatchObject({ code: 'auth/invalid-action-code' });
    await expect(verifyEmailCode('offline')).rejects.toMatchObject({ code: 'auth/network-request-failed' });
    await expect(recoverEmailCode('valid-code')).resolves.toBe('restored@imanager.test');

    expect(verifyPasswordResetCode).not.toHaveBeenCalled();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
    expect(applyActionCode).not.toHaveBeenCalled();
    expect(checkActionCode).not.toHaveBeenCalled();
  });

  it('re-exports spanish messages for sdk failures', () => {
    expect(authActionErrorMessage({ code: 'auth/network-request-failed' })).toMatch(/conexión/i);
  });
});
