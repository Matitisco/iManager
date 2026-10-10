import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth } from '../firebase';

export { authActionErrorMessage } from '../lib/auth-action-errors';

function isE2ETestMode() {
  return import.meta.env.VITE_TEST_AUTH_MODE === 'e2e';
}

function authError(code: string) {
  return Object.assign(new Error(code), { code });
}

const E2E_ACCOUNT = 'owner@imanager.test';
const E2E_RESTORED = 'restored@imanager.test';

function e2eFailure(oobCode: string): void {
  if (oobCode === 'expired') throw authError('auth/expired-action-code');
  if (oobCode === 'used' || oobCode === 'invalid') throw authError('auth/invalid-action-code');
  if (oobCode === 'offline') throw authError('auth/network-request-failed');
  if (!oobCode.trim()) throw authError('auth/invalid-action-code');
}

export async function verifyResetCode(oobCode: string): Promise<string> {
  if (isE2ETestMode()) {
    e2eFailure(oobCode);
    return E2E_ACCOUNT;
  }
  return verifyPasswordResetCode(auth, oobCode);
}

export async function confirmReset(oobCode: string, password: string): Promise<void> {
  if (isE2ETestMode()) {
    if (oobCode === 'offline-confirm') throw authError('auth/network-request-failed');
    if (oobCode === 'weak') throw authError('auth/weak-password');
    if (password.length < 6) throw authError('auth/weak-password');
    return;
  }
  await confirmPasswordReset(auth, oobCode, password);
}

export async function verifyEmailCode(oobCode: string): Promise<void> {
  if (isE2ETestMode()) {
    e2eFailure(oobCode);
    return;
  }
  await applyActionCode(auth, oobCode);
}

export async function recoverEmailCode(oobCode: string): Promise<string> {
  if (isE2ETestMode()) {
    e2eFailure(oobCode);
    return E2E_RESTORED;
  }
  const info = await checkActionCode(auth, oobCode);
  await applyActionCode(auth, oobCode);
  return info.data.email ?? '';
}
