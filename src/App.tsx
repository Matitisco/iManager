/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { TradeIns } from './pages/TradeIns';
import { Clients } from './pages/Clients';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Notifications } from './pages/Notifications';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Modal } from './components/Modal';
import { ProductForm } from './components/forms/ProductForm';
import { ClientForm } from './components/forms/ClientForm';
import { SaleForm } from './components/forms/SaleForm';
import { TradeInForm } from './components/forms/TradeInForm';
import { previewInvitation, type InvitationPreview } from './services/invitations-api';

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

const ROLE_LABEL: Record<string, string> = { OWNER: 'Dueño', ADMIN: 'Socio', SELLER: 'Vendedor' };

function AppContent() {
  const { user, loading, appSession, backendStatus, backendMessage, acceptStoreInvitation } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsTab, setSettingsTab] = useState('store');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteToken] = useState<string | null>(() => extractInviteToken());
  const [invitePreview, setInvitePreview] = useState<InvitationPreview | null>(null);
  const [inviteInvalid, setInviteInvalid] = useState(false);
  const [inviteAccepting, setInviteAccepting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Load invite preview for already-onboarded users
  const showInviteModal = !!(
    inviteToken && user && !loading &&
    backendStatus === 'ready' && !appSession?.onboardingRequired &&
    (invitePreview || inviteInvalid)
  );

  useEffect(() => {
    if (!inviteToken || !user || appSession?.onboardingRequired) return;
    if (backendStatus !== 'ready') return;
    previewInvitation(inviteToken)
      .then((data) => data ? setInvitePreview(data) : setInviteInvalid(true))
      .catch((err) => {
        console.error('[InviteModal] previewInvitation failed:', err);
        setInviteInvalid(true);
      });
  }, [inviteToken, user, backendStatus, appSession?.onboardingRequired]);

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    setInviteError('');
    setInviteAccepting(true);
    try {
      await acceptStoreInvitation(inviteToken);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación');
    } finally {
      setInviteAccepting(false);
    }
  };

  const dismissInvite = () => {
    sessionStorage.removeItem('pendingInviteToken');
    setInvitePreview(null);
    setInviteInvalid(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (backendStatus === 'ready' && appSession?.onboardingRequired) {
    return <Onboarding inviteToken={inviteToken} />;
  }

  const showBackendBanner = backendStatus !== 'ready' && backendStatus !== 'checking';
  const showOnboardingBanner = backendStatus === 'ready' && !!appSession?.onboardingRequired;
  const topPaddingClass = showBackendBanner || showOnboardingBanner ? 'pt-[96px]' : '';

  const handleNavigate = (tab: string, subTab?: string) => {
    setActiveTab(tab);
    if (tab === 'settings' && subTab) {
      setSettingsTab(subTab);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigate} />;
      case 'inventory': return <Inventory />;
      case 'sales': return <Sales />;
      case 'tradeins': return <TradeIns />;
      case 'clients': return <Clients />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings activeTab={settingsTab} setActiveTab={setSettingsTab} />;
      case 'notifications': return <Notifications />;
      default: return <div className="flex items-center justify-center h-full text-gray-400">Página en construcción</div>;
    }
  };

  const getActionLabel = () => {
    switch (activeTab) {
      case 'clients': return 'Nuevo Cliente';
      case 'tradeins': return 'Nuevo Canje';
      case 'sales': return 'Nueva Venta';
      case 'reports': return 'Exportar';
      case 'settings': return 'Guardar';
      default: return 'Nuevo Ingreso';
    }
  };

  const handleNewAction = () => {
    if (activeTab === 'reports' || activeTab === 'settings') {
      alert('Funcionalidad en desarrollo');
      return;
    }
    setIsModalOpen(true);
  };

  const renderModalContent = () => {
    switch (activeTab) {
      case 'clients': return <ClientForm onClose={() => setIsModalOpen(false)} />;
      case 'tradeins': return <TradeInForm onClose={() => setIsModalOpen(false)} />;
      case 'sales': return <SaleForm onClose={() => setIsModalOpen(false)} />;
      default: return <ProductForm onClose={() => setIsModalOpen(false)} />;
    }
  };

  const getModalTitle = () => {
    switch (activeTab) {
      case 'clients': return 'Registrar Nuevo Cliente';
      case 'tradeins': return 'Registrar Nuevo Canje';
      case 'sales': return 'Registrar Nueva Venta';
      default: return 'Ingresar Nuevo Equipo';
    }
  };

  const showHeaderAction = activeTab !== 'reports' && activeTab !== 'settings';

  return (
    <>
      {(showBackendBanner || showOnboardingBanner) && (
        <div className="fixed top-0 left-0 right-0 z-[100]">
          {showBackendBanner && (
            <div
              className={`px-4 py-3 text-sm border-b ${
                backendStatus === 'unconfigured'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : backendStatus === 'offline'
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <div className="max-w-7xl mx-auto">
                <strong className="font-semibold">
                  {backendStatus === 'unconfigured'
                    ? 'Modo local activo'
                    : backendStatus === 'offline'
                      ? 'Backend no disponible'
                      : 'Backend en estado intermedio'}
                </strong>
                <span className="ml-2">
                  {backendMessage || 'La sesión de aplicación todavía no está completamente resuelta.'}
                </span>
              </div>
            </div>
          )}
          {showOnboardingBanner && (
            <div className="px-4 py-3 text-sm border-b bg-blue-50 border-blue-200 text-blue-900">
              <div className="max-w-7xl mx-auto">
                <strong className="font-semibold">Onboarding requerido</strong>
                <span className="ml-2">
                  Tu usuario ya está autenticado, pero todavía no tiene una tienda o membresía asignada en Postgres.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      <div className={topPaddingClass}>
        <Layout
          activeTab={activeTab}
          setActiveTab={handleNavigate}
          actionLabel={showHeaderAction ? getActionLabel() : undefined}
          onNewAction={showHeaderAction ? handleNewAction : undefined}
        >
          {renderContent()}
        </Layout>
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
          {renderModalContent()}
        </Modal>
      </div>

      {/* Invite acceptance modal for already-onboarded users */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-5">
            {inviteInvalid ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900">Invitación inválida</h2>
                <p className="text-sm text-gray-500">Este enlace de invitación expiró o ya fue utilizado.</p>
                <button
                  onClick={dismissInvite}
                  className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold text-gray-900">Te invitaron a una tienda</h2>
                  <p className="text-sm text-gray-500">
                    Fuiste invitado a unirte a{' '}
                    <span className="font-medium text-gray-800">{invitePreview!.storeName}</span>{' '}
                    como <span className="font-medium text-gray-800">{ROLE_LABEL[invitePreview!.role] ?? invitePreview!.role}</span>.
                  </p>
                </div>
                {inviteError && (
                  <p className="text-sm text-red-600">{inviteError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={dismissInvite}
                    disabled={inviteAccepting}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Ignorar
                  </button>
                  <button
                    onClick={handleAcceptInvite}
                    disabled={inviteAccepting}
                    className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
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
