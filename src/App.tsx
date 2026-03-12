/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { TradeIns } from './pages/TradeIns';
import { Clients } from './pages/Clients';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Notifications } from './pages/Notifications';
import { Modal } from './components/Modal';
import { ProductForm } from './components/forms/ProductForm';
import { ClientForm } from './components/forms/ClientForm';
import { SaleForm } from './components/forms/SaleForm';
import { TradeInForm } from './components/forms/TradeInForm';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsTab, setSettingsTab] = useState('store');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const handleNavigate = (tab: string, subTab?: string) => {
    if (tab === 'logout') {
      setIsLoggedIn(false);
      return;
    }
    setActiveTab(tab);
    if (tab === 'settings' && subTab) {
      setSettingsTab(subTab);
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

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

  return (
    <AppProvider>
      <Layout activeTab={activeTab} setActiveTab={handleNavigate} actionLabel={getActionLabel()} onNewAction={handleNewAction}>
        {renderContent()}
      </Layout>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        {renderModalContent()}
      </Modal>
    </AppProvider>
  );
}


