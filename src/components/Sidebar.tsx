import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, RefreshCcw, Users, BarChart2, Settings, Box, X, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen = false, onClose = () => {} }) => {
  const { logout, appSession } = useAppContext();
  const role = appSession?.membership?.role;
  const isStaff = role === 'STAFF';
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'sales', label: 'Ventas', icon: ShoppingCart },
    { id: 'tradeins', label: 'Canjes', icon: RefreshCcw },
    { id: 'clients', label: 'Clientes', icon: Users },
    ...(isStaff ? [] : [
      { id: 'reports', label: 'Reportes', icon: BarChart2 },
      { id: 'settings', label: 'Configuración', icon: Settings },
    ]),
  ];

  const sidebarContent = (
    <aside className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      <div className="p-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ rotate: 90 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
            className="bg-black text-white p-2 rounded-lg"
          >
            <Box size={20} />
          </motion.div>
          <div>
            <h1 className="font-bold text-lg leading-tight">iManager</h1>
            <p className="text-xs text-gray-500 font-medium">GESTION DE EQUIPOS</p>
          </div>
        </div>
        <button onClick={onClose} className="md:hidden text-gray-500 hover:text-gray-900">
          <X size={24} />
        </button>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 relative overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <motion.button
              key={item.id}
              data-testid={`sidebar-tab-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors relative",
                isActive ? "text-white" : "text-gray-600 hover:text-gray-900"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-black rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon size={20} className={cn("relative z-10", isActive ? "text-white" : "text-gray-500")} />
              <span className="relative z-10">{item.label}</span>
            </motion.button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-screen shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar */}
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
