/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { Login } from './pages/Login';
import { AuthActionPage } from './pages/AuthActionPage';
import { Onboarding } from './pages/Onboarding';
import { DeskApp } from './desk/DeskApp';
import { clearSessionClosed, SessionClosed, sessionClosedStore } from './desk/screens/SessionClosed';
import { useInvitationPreview } from './hooks/useInvitationPreview';
import { useAuthActionLink } from './lib/use-auth-action';
import { markPasswordResetNotice } from './lib/password-reset-notice';
import { getAuthAdapter } from './services/auth-adapter';

const INVITE_TOKEN_KEY = 'pendingInviteToken';

function extractInviteToken(): string | null {
  const match = window.location.pathname.match(/^\/invite\/([^/]+)/);
  if (match) {
    const token = match[1];
    sessionStorage.setItem(INVITE_TOKEN_KEY, token);
    window.history.replaceState(null, '', '/');
    return token;
  }
  return sessionStorage.getItem(INVITE_TOKEN_KEY);
}

const ROLE_LABEL: Record<string, string> = { OWNER: 'Dueño', MANAGER: 'Socio', STAFF: 'Empleado' };

function BlockingScreen({
  title,
  message,
  busy = false,
}: {
  title: string;
  message: string;
  busy?: boolean;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white shadow-sm p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          {busy ? (
            <div className="h-7 w-7 rounded-full border-4 border-gray-200 border-t-black animate-spin" />
          ) : (
            <div className="h-3 w-3 rounded-full bg-black" />
          )}
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading, appSession, backendStatus, backendMessage, acceptStoreInvitation, logout } = useAppContext();
  const authAction = useAuthActionLink();
  const [inviteToken, setInviteToken] = useState<string | null>(() => extractInviteToken());
  const [closedVersion, setClosedVersion] = useState(0);
  const [inviteAccepting, setInviteAccepting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const inviteState = useInvitationPreview(
    inviteToken && user && backendStatus === 'ready' && !appSession?.onboardingRequired ? inviteToken : null
  );

  const showInviteModal = !!(
    inviteToken
    && user
    && !loading
    && backendStatus === 'ready'
    && !appSession?.onboardingRequired
    && (inviteState.preview || inviteState.invalid || inviteState.error || inviteState.isLoading)
  );

  const clearInvite = () => {
    sessionStorage.removeItem(INVITE_TOKEN_KEY);
    setInviteToken(null);
    setInviteError('');
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    setInviteError('');
    setInviteAccepting(true);
    try {
      await acceptStoreInvitation(inviteToken);
      clearInvite();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación');
    } finally {
      setInviteAccepting(false);
    }
  };

  const finishAuthAction = async (result: 'password' | null) => {
    if (result === 'password') {
      markPasswordResetNotice();
      clearSessionClosed();
      if (user || getAuthAdapter().getCurrentUser()) {
        try {
          await logout();
        } catch {
          // The login screen is still the next step if sign-out fails.
        }
      }
    }
    authAction.dismiss();
  };

  if (authAction.link) {
    return <AuthActionPage link={authAction.link} onDone={finishAuthAction} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    const storeName = sessionClosedStore();
    if (storeName) {
      return <SessionClosed key={closedVersion} storeName={storeName} onRelogin={() => setClosedVersion((version) => version + 1)} />;
    }
    return <Login inviteToken={inviteToken} />;
  }

  if (backendStatus === 'ready' && appSession?.onboardingRequired) {
    return <Onboarding inviteToken={inviteToken} onInviteAccepted={clearInvite} />;
  }

  if (backendStatus === 'checking') {
    return (
      <BlockingScreen
        busy
        title="Resolviendo sesión segura"
        message="Estamos validando tu sesión, la tienda activa y los permisos antes de abrir el sistema."
      />
    );
  }

  if (backendStatus !== 'ready') {
    return (
      <BlockingScreen
        title={backendStatus === 'offline' ? 'Backend no disponible' : 'Backend no configurado'}
        message={
          backendMessage ||
          'iManager ahora requiere el backend operativo para cargar datos de negocio y validar la membresía de tienda.'
        }
      />
    );
  }

  if (!appSession?.store || !appSession?.membership) {
    return (
      <BlockingScreen
        title="Contexto de tienda incompleto"
        message="Tu cuenta está autenticada, pero todavía no tiene una tienda y membresía resueltas de forma segura en el backend."
      />
    );
  }

  return (
    <>
      <DeskApp />

      {showInviteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 max-[760px]:items-end max-[760px]:px-0">
          <div data-testid="store-invite-modal" className="w-full max-w-md min-w-0 bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-5 max-[760px]:max-h-[92dvh] max-[760px]:overflow-y-auto max-[760px]:overflow-x-hidden max-[760px]:rounded-b-none max-[760px]:rounded-t-3xl max-[760px]:p-5 max-[760px]:pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
            {inviteState.isLoading ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900 break-words">
                  {inviteState.isRetrying ? 'Reintentando verificación...' : 'Verificando invitación...'}
                </h2>
                <p className="text-sm text-gray-500">
                  {inviteState.isRetrying
                    ? 'La tienda tarda en responder, seguimos intentando antes de marcar el enlace.'
                    : 'Estamos cargando los datos de la invitación para que puedas aceptarla.'}
                </p>
              </>
            ) : inviteState.invalid ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900 break-words">Invitación inválida</h2>
                <p className="text-sm text-gray-500">Este enlace de invitación expiró o ya fue utilizado.</p>
                <button
                  onClick={clearInvite}
                  className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
              </>
            ) : inviteState.error ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900 break-words">No pudimos verificar la invitación todavía</h2>
                <p className="text-sm text-gray-500 break-words">{inviteState.error}</p>
                <div className="flex gap-3 max-[760px]:flex-col">
                  <button
                    onClick={clearInvite}
                    disabled={inviteAccepting}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={inviteState.reload}
                    disabled={inviteAccepting}
                    className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 max-[760px]:bg-[#FFD000] max-[760px]:font-bold max-[760px]:text-[#16181D] max-[760px]:hover:bg-[#F2C400]"
                  >
                    Reintentar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold text-gray-900 break-words">Te invitaron a una tienda</h2>
                  <p className="text-sm text-gray-500 break-words">
                    Fuiste invitado a unirte a{' '}
                    <span className="font-medium text-gray-800">{inviteState.preview!.storeName}</span>{' '}
                    como{' '}
                    <span className="font-medium text-gray-800">
                      {ROLE_LABEL[inviteState.preview!.role] ?? inviteState.preview!.role}
                    </span>.
                  </p>
                </div>
                {inviteError && (
                  <p className="text-sm text-red-600">{inviteError}</p>
                )}
                <div className="flex gap-3 max-[760px]:flex-col">
                  <button
                    onClick={clearInvite}
                    disabled={inviteAccepting}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Ignorar
                  </button>
                  <button
                    onClick={handleAcceptInvite}
                    disabled={inviteAccepting}
                    className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 max-[760px]:bg-[#FFD000] max-[760px]:font-bold max-[760px]:text-[#16181D] max-[760px]:hover:bg-[#F2C400]"
                  >
                    {inviteAccepting ? 'Aceptando...' : 'Aceptar invitación'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
