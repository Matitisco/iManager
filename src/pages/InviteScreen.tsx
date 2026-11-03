import { FieldSkeleton } from '../components/Skeleton';
import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { BrandLockup } from '../components/brand-mark';
import { useAppContext } from '../context/AppContext';
import type { UseInvitationPreviewState } from '../hooks/useInvitationPreview';
import { ROLE_LABEL } from '../lib/roles';
import { toActionMessage, isNetworkErrorMessage } from '../lib/user-message';
import { Login } from './Login';
import { sendInvitationEmailVerification } from '../services/auth-action';
import './invite.css';

export function InviteScreen({ token, state, onLeave, onAccept, accepting, error, ready }: {
  token: string;
  state: UseInvitationPreviewState;
  onLeave: () => void;
  onAccept: () => void;
  accepting: boolean;
  error: string;
  ready: boolean;
}) {
  const { user, login, logout } = useAppContext();
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  if (!user && authMode && state.preview) return <Login inviteToken={token} initialRegisterMode={authMode === 'register'} />;
  const preview = state.preview;
  const subtitles = { expired: 'Venció. Pedile un link nuevo a quien te invitó.', used: 'Ya se usó. Pedile un link nuevo a quien te invitó.', revoked: 'Fue cancelada. Pedile un link nuevo a quien te invitó.', not_found: 'No encontramos este link. Pedile uno nuevo a quien te invitó.' };
  return <main className="invite-page" data-testid="accept-invitation-screen">
    <BrandLockup variant="horizontal" className="invite-brand" />
    <section className="invite-card">
      {state.invalid ? <><div className="invite-symbol muted"><Link2 size={28} /></div><h1>Esta invitación ya no sirve</h1><p>{state.reason ? subtitles[state.reason] : 'Venció o ya se usó. Pedile un link nuevo a quien te invitó.'}</p><button type="button" className="invite-primary" onClick={onLeave}>Ir a iManager</button></> : state.error ? isNetworkErrorMessage(state.error) ? null : <><h1>No pudimos verificar la invitación todavía</h1><p role="alert">{state.error}</p><button className="invite-primary" type="button" onClick={state.reload}>Reintentar verificación</button><button className="invite-text" type="button" onClick={onLeave}>Ir a iManager</button></> : !preview ? <FieldSkeleton /> : <>
        <div className="invite-symbol">{preview.storeName.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</div>
        <h1>Sumate a {preview.storeName}</h1><p>{preview.inviterName || 'El propietario'} te invitó al equipo.</p>
        <span className="invite-role">{ROLE_LABEL[preview.role]}</span>
        <p>Si te invitaron por email, usá ese mismo email verificado. Con Google, elegí la cuenta de ese email.</p>
        {error || googleError || accountError ? <p className="invite-error" role="alert">{accountError || error || googleError}</p> : null}
        {user ? <>
          <p>Tu cuenta: {user.email || 'sin email'}</p>
          {user.emailVerified === false ? <><p>Verificá tu email antes de aceptar una invitación dirigida a ese email.</p><button type="button" className="invite-text" disabled={accepting || accountBusy} onClick={() => { setAccountBusy(true); setAccountError(''); void sendInvitationEmailVerification(user.uid).then(() => setVerificationSent(true)).catch(err => setAccountError(toActionMessage(err, 'No se pudo enviar la verificación. Probá de nuevo.'))).finally(() => setAccountBusy(false)); }}>Enviar verificación de email</button></> : null}
          {verificationSent ? <p role="status">Te enviamos un enlace de verificación. Abrilo y después volvé a aceptar esta invitación.</p> : null}
          <button type="button" className="invite-primary" disabled={accepting || accountBusy || !ready} aria-busy={accepting || !ready} onClick={onAccept}>Aceptar invitación</button>
          <button type="button" className="invite-text" disabled={accepting || accountBusy} onClick={() => { setAccountBusy(true); setAccountError(''); void logout().then(() => { setVerificationSent(false); setAuthMode(null); }).catch(err => setAccountError(toActionMessage(err, 'No se pudo cambiar de cuenta. Probá de nuevo.'))).finally(() => setAccountBusy(false)); }}>Usar otro email</button>
          <button type="button" className="invite-text" disabled={accepting || accountBusy} onClick={onLeave}>Ahora no</button>
        </> : <>
          <button type="button" className="invite-google" disabled={googleBusy} aria-busy={googleBusy} onClick={() => { setGoogleBusy(true); setGoogleError(''); void login().catch(err => setGoogleError(toActionMessage(err, 'No se pudo iniciar sesión con Google'))).finally(() => setGoogleBusy(false)); }}><span className="google-ring" aria-hidden="true" />Continuar con Google</button>
          <button type="button" className="invite-primary" onClick={() => setAuthMode('register')}>Crear cuenta con email</button>
          <p className="invite-signin">¿Ya tenés cuenta? <button type="button" onClick={() => setAuthMode('login')}>Iniciá sesión</button></p>
        </>}
      </>}
    </section>
    {preview?.expiresAt ? <p className="invite-expiry">La invitación vence el {new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(preview.expiresAt))}.</p> : null}
  </main>;
}
