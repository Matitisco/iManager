import { useEffect, useState } from 'react';
import {
  Bell,
  LayoutGrid,
  RefreshCcw,
  Settings,
  ShoppingCart,
  Smartphone,
  Users,
  BarChart3,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { initials } from './format';
import { ClientsScreen } from './screens/ClientsScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { NotificationsScreen, SettingsScreen, useUnreadCount } from './screens/AccountScreens';
import { ReportsScreen } from './screens/ReportsScreen';
import { SalesScreen } from './screens/SalesScreen';
import { TradeInsScreen } from './screens/TradeInsScreen';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';
import type { DeskTab, Overlay } from './types';
import './desk.css';

const ROLE: Record<string, string> = { OWNER: 'Propietario', MANAGER: 'Socio', STAFF: 'Agente' };

export function DeskApp() {
  const { appSession, tradeIns, logout } = useAppContext();
  const isStaff = appSession?.membership?.role === 'STAFF';
  const [tab, setTab] = useState<DeskTab>('dashboard');
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const unread = useUnreadCount();
  const openTrades = tradeIns.filter((item) => item.status !== 'LISTO' && item.status !== 'RECHAZADO').length;
  const name = appSession?.user.displayName?.trim() || appSession?.user.email || 'Usuario';

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [message]);

  const go = (next: DeskTab) => {
    if (isStaff && next === 'reports') return;
    setTab(next);
  };

  const ui = {
    tab,
    go,
    open: (next: Overlay) => setOverlay(next),
    close: () => setOverlay(null),
    toast: (text: string) => setMessage(text),
    isStaff,
  };

  const items: { id: DeskTab; label: string; icon: typeof LayoutGrid; meta?: string; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'inventory', label: 'Inventario', icon: Smartphone },
    { id: 'sales', label: 'Ventas', icon: ShoppingCart },
    { id: 'tradeins', label: 'Canjes', icon: RefreshCcw, meta: openTrades ? String(openTrades) : undefined },
    { id: 'clients', label: 'Clientes', icon: Users },
    ...(isStaff ? [] : [{ id: 'reports' as const, label: 'Reportes', icon: BarChart3 }]),
  ];

  return (
    <DeskProvider value={ui}>
      <div className="desk-app">
        <aside className="side">
          <div className="dbrand">
            <div className="dlogo"><Smartphone size={18} strokeWidth={2.4} /></div>
            <div><b>iManager</b><small>{appSession?.store?.name || 'Tienda'}</small></div>
          </div>
          <div className="dgroup">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} className={`ditem${tab === item.id ? ' on' : ''}`} type="button" onClick={() => go(item.id)}>
                  <span className="dic"><Icon size={18} /></span>
                  <span>{item.label}</span>
                  {item.meta ? <span className="dmeta">{item.meta}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="dlabel">Cuenta</div>
          <div className="dgroup">
            <button className={`ditem${tab === 'notifications' ? ' on' : ''}`} type="button" onClick={() => go('notifications')}>
              <span className="dic"><Bell size={18} /></span><span>Notificaciones</span>
              {unread > 0 ? <span className="dcount">{unread}</span> : null}
            </button>
            <button className={`ditem${tab === 'settings' ? ' on' : ''}`} type="button" onClick={() => go('settings')}>
              <span className="dic"><Settings size={18} /></span><span>Configuración</span>
            </button>
          </div>
          <div className="dspacer" />
          <button className="duser" type="button" onClick={() => go('settings')}>
            <div className="av-c b">{initials(name)}</div>
            <div className="info"><b>{name}</b><small>{ROLE[appSession?.membership?.role ?? 'STAFF']}</small></div>
          </button>
          <button className="wlink" type="button" style={{ padding: '8px 12px' }} onClick={() => logout()}>Cerrar sesión</button>
        </aside>
        <main className="stage">
          {tab === 'dashboard' && <DashboardScreen />}
          {tab === 'inventory' && <InventoryScreen />}
          {tab === 'sales' && <SalesScreen />}
          {tab === 'tradeins' && <TradeInsScreen />}
          {tab === 'clients' && <ClientsScreen />}
          {tab === 'reports' && <ReportsScreen />}
          {tab === 'notifications' && <NotificationsScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
        {message ? <div className="toast"><i />{message}</div> : null}
        <DeskOverlays overlay={overlay} />
      </div>
    </DeskProvider>
  );
}
