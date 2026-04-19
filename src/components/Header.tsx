import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Plus, Menu, User, Settings, Shield, LogOut, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { getInitials, trimToString } from '../lib/utils';

interface HeaderProps {
  title?: string;
  onNewAction?: () => void;
  actionLabel?: string;
  onMenuClick?: () => void;
  showSearch?: boolean;
  onNavigate?: (tab: string, subTab?: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  onSearchSubmit?: () => void;
  activeTab?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onNewAction,
  actionLabel = "Nuevo Ingreso",
  onMenuClick,
  showSearch = false,
  onNavigate,
  searchTerm = '',
  onSearchTermChange,
  onSearchSubmit,
  activeTab,
}) => {
  const { logout, user, appSession } = useAppContext();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const notifications: never[] = [];
  const unreadCount = 0;
  const markAllAsRead = () => {};
  const profileName =
    trimToString(appSession?.user.displayName) ||
    trimToString(user?.displayName) ||
    trimToString(user?.email) ||
    'Usuario';
  const profileEmail = appSession?.user.email || user?.email || 'Sin correo';
  const profileRole = appSession?.membership?.role || 'STAFF';
  const profileRoleLabel = profileRole === 'OWNER' ? 'Propietario' : profileRole === 'MANAGER' ? 'Administrador' : 'Vendedor';
  const profileAvatarUrl = appSession?.user.avatarUrl || user?.photoURL || '';
  const profileInitials = getInitials(profileName);

  const searchPlaceholders: Record<string, string> = {
    inventory: 'Buscar por IMEI, modelo o categoría...',
    sales: 'Buscar por cliente, modelo o vendedor...',
    tradeins: 'Buscar por IMEI, modelo o cliente...',
    clients: 'Buscar por nombre, teléfono o email...',
  };
  const searchPlaceholder = searchPlaceholders[activeTab ?? ''] ?? 'Buscar...';

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 md:h-20 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 relative z-50 shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <button onClick={onMenuClick} className="md:hidden text-gray-600 hover:text-gray-900">
          <Menu size={24} />
        </button>
        <AnimatePresence mode="wait">
          {showSearch && (
            <motion.div
              key={activeTab ?? 'search'}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 0, opacity: 0 }}
              transition={{
                scaleX: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.25, ease: 'easeOut' },
              }}
              style={{ transformOrigin: 'left center' }}
              className="flex-1 max-w-2xl hidden sm:block"
            >
              <div className="relative">
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.2 }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  <Search size={20} />
                </motion.div>
                <motion.input
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25, duration: 0.2 }}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(event) => onSearchTermChange?.(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onSearchSubmit?.();
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3 md:gap-6 ml-4">
        {onNewAction && (
          <motion.button 
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNewAction}
            className="bg-black text-white px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">{actionLabel}</span>
            <span className="sm:hidden">Nuevo</span>
          </motion.button>
        )}
        
        <div className="relative" ref={notificationsRef}>
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              setIsProfileOpen(false);
            }}
            className="relative text-gray-500 hover:text-black transition-colors"
          >
            <Bell size={20} className="md:w-6 md:h-6" />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"
                />
              )}
            </AnimatePresence>
          </motion.button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <motion.div
                key="notifications-dropdown"
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-4 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                <div className="p-3 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">Notificaciones</h3>
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.button 
                        key="mark-all-btn"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={markAllAsRead}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        Marcar leídas
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
                <div className="max-h-64 sm:max-h-96 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Sin notificaciones reales todavia
                  </div>
                  {notifications.length === 0 && (
                    <div className="hidden p-8 text-center text-gray-500 text-sm">
                      No hay notificaciones
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-gray-100 bg-gray-50/50 text-center">
                  <button 
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      if (onNavigate) onNavigate('notifications');
                    }}
                    className="text-sm font-semibold text-gray-900 hover:underline"
                  >
                    Ver todas
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative" ref={profileRef}>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotificationsOpen(false);
            }}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-300 cursor-pointer shrink-0 flex items-center justify-center text-xs font-bold text-gray-700"
          >
            {profileAvatarUrl ? (
              <img src={profileAvatarUrl} alt={profileName} className="w-full h-full object-cover" />
            ) : (
              <span>{profileInitials || 'U'}</span>
            )}
          </motion.div>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                key="profile-dropdown"
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-4 w-56 sm:w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                <div className="p-3 sm:p-4 border-b border-gray-100 bg-gray-50/50">
                  <p className="font-bold text-gray-900 text-sm sm:text-base">{profileName}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{profileEmail}</p>
                  <div className="mt-2 inline-block px-2 py-1 bg-gray-200 text-gray-700 text-[10px] font-bold rounded uppercase tracking-wide">{profileRoleLabel}</div>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onNavigate?.('settings', 'profile');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <User size={16} /> Mi Perfil
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onNavigate?.('settings', 'security');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <Shield size={16} /> Seguridad
                  </button>
                  {profileRole !== 'STAFF' && (
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        onNavigate?.('settings', 'store');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <Settings size={16} /> Configuración
                    </button>
                  )}
                </div>
                <div className="p-2 border-t border-gray-100">
                  <button 
                    onClick={async () => {
                      setIsProfileOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <LogOut size={16} /> Cerrar Sesión
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
