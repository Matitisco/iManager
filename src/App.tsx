/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
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
import { useInvitationPreview } from './hooks/useInvitationPreview';

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

const ROLE_LABEL: Record<string, string> = { OWNER: 'DueÃ±o', MANAGER: 'Socio', STAFF: 'Vendedor' };

function AppContent() {
  const { user, loading, appSession, backendStatus, backendMessage, acceptStoreInvitation } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsTab, setSettingsTab] = useState('store');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [topNavSearch, setTopNavSearch] = useState('');
  const [inviteToken, setInviteToken] = useState<string | null>(() => extractInviteToken());
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
      setInviteError(err instanceof Error ? err.message : 'No se pudo aceptar la invitaciÃ³n');
    } finally {
      setInviteAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login inviteToken={inviteToken} />;
  }

  if (backendStatus === 'ready' && appSession?.onboardingRequired) {
    return <Onboarding inviteToken={inviteToken} onInviteAccepted={clearInvite} />;
  }

  const showBackendBanner = backendStatus !== 'ready' && backendStatus !== 'checking';
  const showOnboardingBanner = backendStatus === 'ready' && !!appSession?.onboardingRequired;
  const topPaddingClass = showBackendBanner || showOnboardingBanner ? 'pt-[96px]' : '';
  const searchableTabs = new Set(['inventory', 'clients', 'sales', 'tradeins']);
  const showTopNavSearch = searchableTabs.has(activeTab);
  const role = appSession?.membership?.role;
  const isStaff = role === 'STAFF';
  const staffBlockedTabs = new Set(['reports', 'settings']);

  useEffect(() => {
    if (!showTopNavSearch && topNavSearch) {
      setTopNavSearch('');
    }
  }, [showTopNavSearch, topNavSearch]);

  useEffect(() => {
    if (isStaff && staffBlockedTabs.has(activeTab) && activeTab !== 'settings') {
      setActiveTab('dashboard');
    }
    // STAFF may land on settings via Profile/Security shortcut — allow only those subtabs
    if (isStaff && activeTab === 'settings' && settingsTab !== 'profile' && settingsTab !== 'security') {
      setActiveTab('dashboard');
    }
  }, [isStaff, activeTab, settingsTab]);

  const handleNavigate = (tab: string, subTab?: string) => {
    if (isStaff && tab === 'reports') return;
    if (isStaff && tab === 'settings' && subTab !== 'profile' && subTab !== 'security') return;
    setActiveTab(tab);
    if (tab === 'settings' && subTab) {
      setSettingsTab(subTab);
    }
  };

  const handleSearchSubmit = () => {
    const normalizedSearch = topNavSearch.trim();
    if (!normalizedSearch) {
      return;
    }

    if (!searchableTabs.has(activeTab)) {
      setActiveTab('inventory');
    }

    setTopNavSearch(normalizedSearch);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigate} />;
      case 'inventory': return <Inventory searchTerm={topNavSearch} />;
      case 'sales': return <Sales searchTerm={topNavSearch} />;
      case 'tradeins': return <TradeIns searchTerm={topNavSearch} />;
      case 'clients': return <Clients searchTerm={topNavSearch} />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings activeTab={settingsTab} setActiveTab={setSettingsTab} />;
      case 'notifications': return <Notifications />;
      default: return <div className="flex items-center justify-center h-full text-gray-400">PÃ¡gina en construcciÃ³n</div>;
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
                  {backendMessage || 'La sesiÃ³n de aplicaciÃ³n todavÃ­a no estÃ¡ completamente resuelta.'}
                </span>
              </div>
            </div>
          )}
          {showOnboardingBanner && (
            <div className="px-4 py-3 text-sm border-b bg-blue-50 border-blue-200 text-blue-900">
              <div className="max-w-7xl mx-auto">
                <strong className="font-semibold">Onboarding requerido</strong>
                <span className="ml-2">
                  Tu usuario ya estÃ¡ autenticado, pero todavÃ­a no tiene una tienda o membresÃ­a asignada en Postgres.
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
          showSearch={showTopNavSearch}
          searchTerm={topNavSearch}
          onSearchTermChange={setTopNavSearch}
          onSearchSubmit={handleSearchSubmit}
        >
          {renderContent()}
        </Layout>
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
          {renderModalContent()}
        </Modal>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-5">
            {inviteState.isLoading ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  {inviteState.isRetrying ? 'Reintentando verificación…' : 'Verificando invitación…'}
                </h2>
                <p className="text-sm text-gray-500">
                  {inviteState.isRetrying
                    ? 'La tienda tarda en responder, seguimos intentando antes de marcar el enlace.'
                    : 'Estamos cargando los datos de la invitación para que puedas aceptarla.'}
                </p>
              </>
            ) : inviteState.invalid ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900">InvitaciÃ³n invÃ¡lida</h2>
                <p className="text-sm text-gray-500">Este enlace de invitaciÃ³n expirÃ³ o ya fue utilizado.</p>
                <button
                  onClick={clearInvite}
                  className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
              </>
            ) : inviteState.error ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900">No pudimos verificar la invitación todavía</h2>
                <p className="text-sm text-gray-500">{inviteState.error}</p>
                <div className="flex gap-3">
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
                    className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    Reintentar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold text-gray-900">Te invitaron a una tienda</h2>
                  <p className="text-sm text-gray-500">
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
                <div className="flex gap-3">
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
                    className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {inviteAccepting ? 'Aceptando...' : 'Aceptar invitaciÃ³n'}
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
