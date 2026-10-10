export const PASSWORD_RESET_LOGIN_NOTICE = 'Tu contraseña se actualizó. Ya podés iniciar sesión.';

const NOTICE_KEY = 'imanager:password-reset-notice';

export function markPasswordResetNotice() {
  try {
    sessionStorage.setItem(NOTICE_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function consumePasswordResetNotice(): boolean {
  try {
    const active = sessionStorage.getItem(NOTICE_KEY) === '1';
    if (active) sessionStorage.removeItem(NOTICE_KEY);
    return active;
  } catch {
    return false;
  }
}
