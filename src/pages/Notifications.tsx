import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Package, AlertTriangle, Info, Search, Filter, MoreVertical, Trash2, Check, Bell } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const MOCK_NOTIFICATIONS = [
  {
    id: '1',
    type: 'success',
    title: 'Venta completada',
    message: 'iPhone 15 Pro Max vendido a Carlos Méndez.',
    time: 'Hace 5 min',
    read: false,
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100'
  },
  {
    id: '2',
    type: 'warning',
    title: 'Stock bajo',
    message: 'Quedan 2 unidades de Samsung S24 Ultra.',
    time: 'Hace 2 horas',
    read: false,
    icon: Package,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100'
  },
  {
    id: '3',
    type: 'error',
    title: 'Error de sincronización',
    message: 'No se pudo sincronizar el inventario con la tienda online. Reintentando...',
    time: 'Hace 3 horas',
    read: true,
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  },
  {
    id: '4',
    type: 'info',
    title: 'Nuevo canje registrado',
    message: 'Se ha registrado un nuevo canje de MacBook Air M1 para evaluación.',
    time: 'Ayer',
    read: true,
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  {
    id: '5',
    type: 'success',
    title: 'Reporte generado',
    message: 'El reporte de ventas mensuales está listo para descargar.',
    time: 'Ayer',
    read: true,
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100'
  },
  {
    id: '6',
    type: 'warning',
    title: 'Actualización pendiente',
    message: 'Hay una nueva versión del sistema disponible. Por favor, actualice cuando sea posible.',
    time: 'Hace 2 días',
    read: true,
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100'
  }
];

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleDelete = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesFilter = filter === 'all' || (filter === 'unread' && !n.read);
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          n.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4">
        <p className="text-sm font-semibold">Módulo en preview:</p>
        <p className="text-sm mt-1">
          Estas notificaciones todavía son locales/mock. Sirven para revisar UI, no para validar eventos reales del sistema.
        </p>
      </div>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Notificaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tienes {unreadCount} {unreadCount === 1 ? 'notificación sin leer' : 'notificaciones sin leer'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.button 
                key="mark-all-btn"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleMarkAllAsRead}
                className="text-sm font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
              >
                <Check size={16} />
                Marcar todas como leídas
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Filters and Search */}
      <motion.div layout className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-sm">
        <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto relative">
          <button
            onClick={() => setFilter('all')}
            className={`relative z-10 flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              filter === 'all' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Todas
            {filter === 'all' && (
              <motion.div 
                layoutId="filter-bg"
                className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`relative z-10 flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              filter === 'unread' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Sin leer
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span 
                  key="unread-badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none"
                >
                  {unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
            {filter === 'unread' && (
              <motion.div 
                layoutId="filter-bg"
                className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar notificaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
          />
        </div>
      </motion.div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
        <AnimatePresence mode="wait">
          {filteredNotifications.length > 0 ? (
            <motion.div 
              key="list"
              variants={container} 
              initial="hidden" 
              animate="show" 
              exit={{ opacity: 0 }}
              className="divide-y divide-gray-100"
            >
              <AnimatePresence mode="popLayout">
                {filteredNotifications.map((notification) => {
                  const Icon = notification.icon;
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.98, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      key={notification.id} 
                      className={`p-4 sm:p-6 flex gap-4 transition-colors relative group ${
                        notification.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/30 hover:bg-blue-50/50'
                      }`}
                    >
                  {!notification.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                  )}
                  
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notification.bgColor} ${notification.color}`}>
                    <Icon size={20} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <h3 className={`text-sm font-bold truncate ${notification.read ? 'text-gray-900' : 'text-black'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs font-medium text-gray-400 whitespace-nowrap">
                        {notification.time}
                      </span>
                    </div>
                    <p className={`text-sm ${notification.read ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>
                      {notification.message}
                    </p>
                  </div>

                  <div className="flex items-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && (
                      <button 
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Marcar como leída"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(notification.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px]"
            >
              <motion.div 
                initial={{ rotate: -10 }}
                animate={{ rotate: [10, -10, 10, -10, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"
              >
                <Bell className="text-gray-300" size={32} />
              </motion.div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">No hay notificaciones</h3>
              <p className="text-gray-500 text-sm max-w-sm">
                {searchQuery 
                  ? 'No se encontraron notificaciones que coincidan con tu búsqueda.' 
                  : filter === 'unread' 
                    ? '¡Estás al día! No tienes notificaciones sin leer.' 
                    : 'Aún no tienes notificaciones en tu historial.'}
              </p>
              {(searchQuery || filter !== 'all') && (
                <button 
                  onClick={() => {
                    setFilter('all');
                    setSearchQuery('');
                  }}
                  className="mt-4 text-sm font-semibold text-black hover:underline"
                >
                  Ver todas las notificaciones
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
