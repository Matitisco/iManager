import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, RefreshCcw, Users, BarChart2, Settings, Bell, X, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { BrandLockup } from './BrandMark';
import { ROLE_LABEL, buildStoreActivity, initials, isOpenTradeIn } from '../mobile/logic';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string, subTab?: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

function readNotificationIds() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem('im-mobile-read') ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen = false, onClose = () => {} }) => {
  const { logout, appSession, sales, tradeIns, inventory, clients } = useAppContext();
  const role = appSession?.membership?.role;
  const isStaff = role === 'STAFF';
  const storeName = appSession?.store?.name?.trim() || 'Tu tienda';
  const userName = appSession?.user?.displayName?.trim() || appSession?.user?.email || 'Tu cuenta';
  const roleLabel = ROLE_LABEL[role ?? 'STAFF'] ?? 'Agente';
  const openTrades = (tradeIns ?? []).filter((trade) => isOpenTradeIn(trade.status)).length;
  const readIds = readNotificationIds();
  const unread = buildStoreActivity({
    sales: sales ?? [],
    tradeIns: tradeIns ?? [],
    inventory: inventory ?? [],
    clients: clients ?? [],
  }).filter((item) => !readIds.has(item.id)).length;

  const mainItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'sales', label: 'Ventas', icon: ShoppingCart },
    { id: 'tradeins', label: 'Canjes', icon: RefreshCcw, badge: openTrades },
    { id: 'clients', label: 'Clientes', icon: Users },
    ...(isStaff ? [] : [{ id: 'reports', label: 'Reportes', icon: BarChart2 }]),
  ];
  const accountItems = [
    { id: 'notifications', label: 'Notificaciones', icon: Bell, badge: unread },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  const openTab = (id: string) => {
    if (id === 'settings' && isStaff) {
      setActiveTab('settings', 'profile');
      return;
    }
    setActiveTab(id);
  };

  const itemButton = (item: { id: string; label: string; icon: typeof Bell; badge?: number }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        data-testid={`sidebar-tab-${item.id}`}
        onClick={() => openTab(item.id)}
        className={cn(
          'w-full flex items-center gap-3 h-[42px] px-3 rounded-xl text-sm font-bold transition-colors',
          isActive ? 'bg-[#F5FBD7] text-[#16181D]' : 'text-[#737984] hover:bg-[#F3F4F6] hover:text-[#16181D]',
        )}
      >
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{item.label}</span>
        {item.badge ? (
          <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-[#16181D] text-white text-[11px] font-extrabold flex items-center justify-center">
            {item.badge}
          </span>
        ) : null}
      </button>
    );
  };

  const sidebarContent = (
    <aside className="w-[248px] bg-white border-r border-[#E6E8EC] h-full flex flex-col px-3.5 pt-5 pb-4">
      <div className="flex items-start justify-between gap-2 px-2 pb-4">
        <BrandLockup subtitle={storeName} />
        <button type="button" onClick={onClose} className="md:hidden text-gray-500 hover:text-gray-900" aria-label="Cerrar menú">
          <X size={24} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-0.5">
          {mainItems.map(itemButton)}
        </div>
        <div className="px-3 pt-4 pb-1.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#737984]">
          Cuenta
        </div>
        <div className="flex flex-col gap-0.5">
          {accountItems.map(itemButton)}
        </div>
      </nav>

      <button
        type="button"
        onClick={() => openTab('settings')}
        className="mt-3 flex items-center gap-2.5 rounded-[14px] px-2.5 py-2.5 text-left hover:bg-[#F3F4F6]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5B8DEF] text-[13px] font-extrabold text-white">
          {initials(userName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-[#16181D]">{userName}</span>
          <span className="block text-xs font-semibold text-[#737984]">{roleLabel}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={logout}
        className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#DC4C4C] hover:bg-red-50"
      >
        <LogOut size={16} />
        Cerrar sesión
      </button>
    </aside>
  );

  return (
    <>
      <div className="hidden md:block h-screen shrink-0">
        {sidebarContent}
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-[70] md:hidden"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
