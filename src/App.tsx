/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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

function AppContent() {
  const { user, loading, appSession, backendStatus, backendMessage } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsTab, setSettingsTab] = useState('store');
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    return <Onboarding />;
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
