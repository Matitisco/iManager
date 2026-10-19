import { ApiError } from './services/api-client';
import { InviteScreen } from './pages/InviteScreen';
import { OnboardingJourney } from './pages/OnboardingJourney';
import { toUserMessage } from './lib/user-message';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { Login } from './pages/Login';
import { StoreActivityPage } from './pages/StoreActivity';
import { isStoreActivityPath } from './lib/store-activity';
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
  const inviteState = useInvitationPreview(inviteToken);

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
      if (err instanceof ApiError && err.status === 410) inviteState.reload();
      setInviteError(toUserMessage(err, 'No se pudo aceptar la invitación'));
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

  if (inviteToken) return <InviteScreen token={inviteToken} state={inviteState} onLeave={clearInvite} onAccept={() => { void handleAcceptInvite(); }} accepting={inviteAccepting} error={inviteError || (user && ['offline', 'error', 'unconfigured'].includes(backendStatus) ? backendMessage || 'No pudimos preparar tu cuenta. Reintentá en unos segundos.' : '')} ready={backendStatus === 'ready'} />;

  if (loading && !user) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || backendStatus === 'unauthorized') {
    const storeName = sessionClosedStore();
    if (storeName) {
      return <SessionClosed key={closedVersion} storeName={storeName} onRelogin={() => setClosedVersion((version) => version + 1)} />;
    }
    return <Login inviteToken={inviteToken} />;
  }

  if (isStoreActivityPath(window.location.pathname)) {
    return <StoreActivityPage />;
  }

  if (backendStatus === 'ready' && appSession?.onboardingRequired) {
    return <Onboarding inviteToken={inviteToken} onInviteAccepted={clearInvite} />;
  }

  if (backendStatus === 'ready' && appSession?.membership?.role === 'OWNER' && appSession.store?.onboardingStartedAt && !appSession.store.onboardingCompletedAt && !appSession.billing?.readOnly) {
    return <OnboardingJourney />;
  }

  if (backendStatus === 'ready' && (!appSession?.store || !appSession?.membership)) {
    return (
      <BlockingScreen
        title="Contexto de tienda incompleto"
        message="Tu cuenta está autenticada, pero todavía no tiene una tienda y membresía resueltas de forma segura en el backend."
      />
    );
  }

  if (backendStatus !== 'ready' && backendStatus !== 'checking') {
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

  return <DeskApp />;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
