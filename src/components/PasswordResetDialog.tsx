import React, { useEffect, useRef, useState } from 'react';
import { Field } from '../desk/ui';
import '../desk/desk.css';
import {
  PASSWORD_RESET_SENT_MESSAGE,
  passwordResetErrorMessage,
  requestPasswordReset,
} from '../services/password-reset';

interface PasswordResetDialogProps {
  initialEmail: string;
  onClose: () => void;
}

export const PasswordResetDialog: React.FC<PasswordResetDialogProps> = ({ initialEmail, onClose }) => {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const sendingRef = useRef(false);
  const aliveRef = useRef(true);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    aliveRef.current = true;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      aliveRef.current = false;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      if (!aliveRef.current) return;
      setSent(true);
    } catch (err) {
      if (!aliveRef.current) return;
      setError(passwordResetErrorMessage(err));
    } finally {
      sendingRef.current = false;
      if (aliveRef.current) setSending(false);
    }
  };

  return (
    <div className="desk-app reset-host">
      <div className="ov reset" onMouseDown={onClose}>
        <form
          className="sheet compact"
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-reset-title"
          onMouseDown={(event) => event.stopPropagation()}
          onSubmit={submit}
        >
          <h3 id="password-reset-title">¿Olvidaste tu contraseña?</h3>
          {sent ? (
            <>
              <p className="reset-ok" data-testid="password-reset-success">
                {PASSWORD_RESET_SENT_MESSAGE}
              </p>
              <div className="sacts one">
                <button type="button" className="btn2 p" onClick={onClose}>
                  Volver al inicio
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="sub">Escribí tu correo y te enviamos un link para elegir una contraseña nueva.</p>
              <Field label="Correo electrónico" error={error ?? undefined}>
                <input
                  data-testid="password-reset-email"
                  type="email"
                  name="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  required
                  value={email}
                  disabled={sending}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                />
              </Field>
              <div className="sacts">
                <button type="button" className="btn2 s" onClick={onClose} disabled={sending}>
                  Cancelar
                </button>
                <button type="submit" className="btn2 p" data-testid="password-reset-submit" disabled={sending}>
                  {sending ? 'Enviando…' : 'Enviar link'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
