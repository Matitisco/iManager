function codeOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return '';
}

export function authActionErrorMessage(error: unknown): string {
  switch (codeOf(error)) {
    case 'auth/expired-action-code':
      return 'Este enlace venció. Pedí uno nuevo desde el inicio de sesión.';
    case 'auth/invalid-action-code':
      return 'Este enlace ya fue usado o no es válido. Pedí uno nuevo desde el inicio de sesión.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil. Usá al menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intentá de nuevo más tarde.';
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada. Escribinos si necesitás ayuda.';
    case 'auth/user-not-found':
      return 'No encontramos la cuenta de este enlace.';
    default:
      return 'No pudimos completar la acción. Intentá de nuevo.';
  }
}
