import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Plus, Menu, User, Settings, LogOut, Package, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  title?: string;
  onNewAction?: () => void;
  actionLabel?: string;
  onMenuClick?: () => void;
  onNavigate?: (tab: string, subTab?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onNewAction, actionLabel = "Nuevo Ingreso", onMenuClick, onNavigate }) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Venta completada",
      message: "iPhone 15 Pro Max vendido a Carlos Méndez.",
      time: "Hace 5 min",
      icon: CheckCircle2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
      read: false
    },
    {
      id: 2,
      title: "Stock bajo",
      message: "Quedan 2 unidades de Samsung S24 Ultra.",
      time: "Hace 2 horas",
      icon: Package,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      read: false
    }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };
  
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
        <div className="flex-1 max-w-2xl hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por IMEI, cliente o modelo..." 
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6 ml-4">
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
                className="absolute right-0 mt-4 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-bold text-gray-900">Notificaciones</h3>
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
                <div className="max-h-96 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <AnimatePresence mode="popLayout">
                    {notifications.map((notification) => {
                      const Icon = notification.icon;
                      return (
                        <motion.div 
                          layout
                          key={notification.id}
                          onClick={() => markAsRead(notification.id)}
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-4 border-b border-gray-50 transition-colors cursor-pointer relative overflow-hidden ${
                            notification.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/30 hover:bg-blue-50/50'
                          }`}
                        >
                          <AnimatePresence>
                            {!notification.read && (
                              <motion.div 
                                key="unread-bar"
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 4, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                className="absolute left-0 top-0 bottom-0 bg-blue-500"
                              />
                            )}
                          </AnimatePresence>
                          <div className="flex gap-3">
                            <motion.div 
                              layout
                              whileHover={{ rotate: 15, scale: 1.1 }}
                              className={`w-8 h-8 rounded-full ${notification.bgColor} ${notification.color} flex items-center justify-center shrink-0`}
                            >
                              <Icon size={16} />
                            </motion.div>
                            <motion.div layout className="flex-1">
                              <motion.p layout className={`text-sm ${notification.read ? 'text-gray-900 font-medium' : 'text-black font-bold'}`}>
                                {notification.title}
                              </motion.p>
                              <motion.p layout className={`text-xs mt-0.5 ${notification.read ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>
                                {notification.message}
                              </motion.p>
                              <motion.p layout className="text-[10px] text-gray-400 mt-1 font-medium">{notification.time}</motion.p>
                            </motion.div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {notifications.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm">
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
            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-300 cursor-pointer shrink-0"
          >
            <img src="https://i.pravatar.cc/150?img=11" alt="User" className="w-full h-full object-cover" />
          </motion.div>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                key="profile-dropdown"
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-4 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                  <p className="font-bold text-gray-900">Carlos Méndez</p>
                  <p className="text-xs text-gray-500 mt-0.5">carlos@imanager.com</p>
                  <div className="mt-2 inline-block px-2 py-1 bg-gray-200 text-gray-700 text-[10px] font-bold rounded uppercase tracking-wide">
                    Administrador
                  </div>
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
                      onNavigate?.('settings', 'store');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <Settings size={16} /> Configuración
                  </button>
                </div>
                <div className="p-2 border-t border-gray-100">
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      onNavigate?.('logout');
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
