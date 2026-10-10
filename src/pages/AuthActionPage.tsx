import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Box, Eye, EyeOff } from 'lucide-react';
import { authActionErrorMessage } from '../lib/auth-action-errors';
import type { AuthActionLink } from '../lib/auth-action-url';
import {
  confirmReset,
  recoverEmailCode,
  verifyEmailCode,
  verifyResetCode,
} from '../services/auth-action';
import '../desk/desk.css';

const MISSING_CODE = 'Este enlace no incluye un código válido. Pedí uno nuevo desde el inicio de sesión.';
const UNSUPPORTED = 'Este enlace no se puede abrir en iManager. Volvé al inicio de sesión o pedí un correo nuevo.';
const SHORT_PASSWORD = 'La contraseña debe tener al menos 6 caracteres.';
const MISMATCH = 'Las contraseñas no coinciden.';

export type AuthActionResult = 'password' | null;

interface AuthActionPageProps {
  link: AuthActionLink;
  onDone: (result: AuthActionResult) => Promise<void> | void;
}

function titleFor(mode: string): string {
  if (mode === 'resetPassword') return 'Nueva contraseña';
  if (mode === 'verifyEmail' || mode === 'verifyAndChangeEmail') return 'Verificar correo';
  if (mode === 'recoverEmail') return 'Recuperar correo';
  return 'Enlace de cuenta';
}

export const AuthActionPage: React.FC<AuthActionPageProps> = ({ link, onDone }) => {
  const [phase, setPhase] = useState<'loading' | 'form' | 'done' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [doneMessage, setDoneMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fail = (message: string) => {
      if (cancelled) return;
      setError(message);
      setPhase('error');
    };

    async function run() {
      setPhase('loading');
      setError(null);
      setDoneMessage('');
      if (!link.mode || !link.oobCode) {
        fail(MISSING_CODE);
        return;
      }
      try {
        if (link.mode === 'resetPassword') {
          const account = await verifyResetCode(link.oobCode);
          if (cancelled) return;
          setEmail(account);
          setPhase('form');
          return;
        }
        if (link.mode === 'verifyEmail' || link.mode === 'verifyAndChangeEmail') {
          await verifyEmailCode(link.oobCode);
          if (cancelled) return;
          setDoneMessage(
            link.mode === 'verifyEmail'
              ? 'Tu correo quedó verificado. Ya podés iniciar sesión.'
              : 'Confirmamos el cambio de correo. Ya podés iniciar sesión.',
          );
          setPhase('done');
          return;
        }
        if (link.mode === 'recoverEmail') {
          const restored = await recoverEmailCode(link.oobCode);
          if (cancelled) return;
          setDoneMessage(
            restored
              ? `Restauramos el correo ${restored}. Ya podés iniciar sesión.`
              : 'Restauramos tu correo. Ya podés iniciar sesión.',
          );
          setPhase('done');
          return;
        }
        fail(UNSUPPORTED);
      } catch (err) {
        fail(authActionErrorMessage(err));
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [link.mode, link.oobCode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    if (password.length < 6) {
      setError(SHORT_PASSWORD);
      return;
    }
    if (password !== confirm) {
      setError(MISMATCH);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await confirmReset(link.oobCode, password);
      await onDone('password');
    } catch (err) {
      if (!aliveRef.current) return;
      setError(authActionErrorMessage(err));
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  };

  const leave = () => {
    void onDone(null);
  };

  return (
    <div className="desk-app auth-action" data-testid="auth-action-screen">
      <motion.main
        className="auth-card"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="mark" aria-hidden="true">
          <Box size={28} />
        </div>
        <div className="brand">iManager</div>
        <h1>{titleFor(link.mode)}</h1>

        {phase === 'loading' && (
          <p className="wait" data-testid="auth-action-loading" role="status">
            <i />
            Estamos comprobando el enlace…
          </p>
        )}

        {error && (
          <p className="auth-banner bad" data-testid="auth-action-error" role="alert">
            {error}
          </p>
        )}

        {phase === 'form' && (
          <form onSubmit={submit} noValidate>
            <p className="lead">
              Elegí una contraseña nueva para{' '}
              <strong data-testid="auth-action-email">{email}</strong>.
            </p>
            <div className="fl">
              <span>
                <label htmlFor="reset-password">Nueva contraseña</label>
              </span>
              <div className="pw">
                <input
                  id="reset-password"
                  data-testid="reset-password"
                  type={visible ? 'text' : 'password'}
                  name="new-password"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  disabled={busy}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  data-testid="reset-password-toggle"
                  aria-pressed={visible}
                  aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setVisible((current) => !current)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="fl">
              <span>
                <label htmlFor="reset-password-confirm">Confirmar contraseña</label>
              </span>
              <div className="pw">
                <input
                  id="reset-password-confirm"
                  data-testid="reset-password-confirm"
                  type={visible ? 'text' : 'password'}
                  name="confirm-password"
                  autoComplete="new-password"
                  value={confirm}
                  disabled={busy}
                  onChange={(event) => {
                    setConfirm(event.target.value);
                    setError(null);
                  }}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  data-testid="reset-password-confirm-toggle"
                  aria-pressed={visible}
                  aria-label={visible ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                  onClick={() => setVisible((current) => !current)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="cta" data-testid="reset-password-submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        {phase === 'done' && (
          <p className="auth-banner ok" data-testid="auth-action-done" role="status">
            {doneMessage}
          </p>
        )}

        {phase !== 'loading' && (
          <button type="button" className="text-btn" data-testid="auth-action-back" onClick={leave} disabled={busy}>
            {phase === 'done' ? 'Ir al inicio de sesión' : 'Volver al inicio de sesión'}
          </button>
        )}
      </motion.main>
    </div>
  );
};
