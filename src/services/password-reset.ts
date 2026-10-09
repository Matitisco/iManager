import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

export const PASSWORD_RESET_SENT_MESSAGE =
  'Si el email está registrado, te mandamos un link para cambiar la contraseña';

function authErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return '';
}

export function passwordResetErrorMessage(error: unknown): string {
  switch (authErrorCode(error)) {
    case 'auth/network-request-failed':
      return 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intentá de nuevo más tarde.';
    case 'auth/invalid-email':
      return 'El correo electrónico no es válido.';
    default:
      return 'No pudimos enviar el link. Intentá de nuevo.';
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim();
  if (!normalized) {
    throw Object.assign(new Error('Invalid email'), { code: 'auth/invalid-email' });
  }

  if (import.meta.env.VITE_TEST_AUTH_MODE === 'e2e') return;

  try {
    await sendPasswordResetEmail(auth, normalized);
  } catch (error) {
    // Same outcome whether or not the account exists.
    if (authErrorCode(error) === 'auth/user-not-found') return;
    throw error;
  }
}
