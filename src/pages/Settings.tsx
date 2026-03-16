import React, { useState } from 'react';
import { Store, User, Bell, Shield, CreditCard, Smartphone, Save, Check, Key, Mail, Lock, Link as LinkIcon, Download } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

interface SettingsProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  activeTab: externalActiveTab,
  setActiveTab: externalSetActiveTab
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState('store');

  const activeTab = externalActiveTab || internalActiveTab;
  const setActiveTab = externalSetActiveTab || setInternalActiveTab;

  const tabs = [
    { id: 'store', label: 'Datos de la Tienda', icon: Store },
    { id: 'profile', label: 'Mi Perfil', icon: User },
    { id: 'notifications', label: 'Notificaciones', icon: Bell },
    { id: 'security', label: 'Seguridad', icon: Shield },
    { id: 'billing', label: 'Facturación', icon: CreditCard },
    { id: 'integrations', label: 'Integraciones', icon: Smartphone },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'store':
        return (
          <motion.div 
            key="store"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-8 w-full"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-6">Información de la Tienda</h2>
            
            <div className="space-y-6">
              <div className="flex items-center gap-6 pb-6 border-b border-gray-100">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl border border-gray-200 flex items-center justify-center text-gray-400">
                  <Store size={32} />
                </div>
                <div>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 mb-2 transition-colors">
                    Cambiar Logo
                  </motion.button>
                  <p className="text-xs text-gray-500">JPG, GIF o PNG. Tamaño máximo de 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Nombre de la Tienda</label>
                  <input type="text" defaultValue="iManager Store" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Razón Social</label>
                  <input type="text" defaultValue="iManager S.A." className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">CUIT / RUT</label>
                  <input type="text" defaultValue="30-12345678-9" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Teléfono de Contacto</label>
                  <input type="text" defaultValue="+54 11 1234-5678" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-gray-700">Dirección Comercial</label>
                  <input type="text" defaultValue="Av. Libertador 1234, CABA" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Configuración Regional</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Moneda Principal</label>
                    <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none appearance-none transition-shadow">
                      <option>ARS - Peso Argentino</option>
                      <option>USD - Dólar Estadounidense</option>
                      <option>EUR - Euro</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Zona Horaria</label>
                    <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none appearance-none transition-shadow">
                      <option>(GMT-03:00) Buenos Aires</option>
                      <option>(GMT-05:00) Bogotá, Lima, Quito</option>
                      <option>(GMT-06:00) Ciudad de México</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-6 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 flex items-center gap-2 transition-colors">
                  <Save size={16} /> Guardar Cambios
                </motion.button>
              </div>
            </div>
          </motion.div>
        );
      case 'profile':
        return (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-8 w-full"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-6">Mi Perfil</h2>
            <div className="space-y-6">
              <div className="flex items-center gap-6 pb-6 border-b border-gray-100">
                <div className="w-20 h-20 bg-gray-100 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 overflow-hidden">
                  <img src="https://i.pravatar.cc/150?img=11" alt="Profile" className="w-full h-full object-cover" />
                </div>
                <div>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 mb-2 transition-colors">
                    Cambiar Foto
                  </motion.button>
                  <p className="text-xs text-gray-500">JPG, GIF o PNG. Tamaño máximo de 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Nombre</label>
                  <input type="text" defaultValue="Carlos" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Apellido</label>
                  <input type="text" defaultValue="Méndez" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-gray-700">Correo Electrónico</label>
                  <input type="email" defaultValue="carlos@imanager.com" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-gray-700">Rol</label>
                  <input type="text" defaultValue="Administrador" disabled className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed" />
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-6 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 flex items-center gap-2 transition-colors">
                  <Save size={16} /> Guardar Cambios
                </motion.button>
              </div>
            </div>
          </motion.div>
        );
      case 'notifications':
        return (
          <motion.div 
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-8 w-full"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-6">Preferencias de Notificaciones</h2>
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Notificaciones por Email</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Resumen Diario</p>
                    <p className="text-xs text-gray-500">Recibe un resumen de las ventas y canjes del día.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Alertas de Stock Bajo</p>
                    <p className="text-xs text-gray-500">Notificar cuando un producto baje del mínimo establecido.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Nuevos Canjes</p>
                    <p className="text-xs text-gray-500">Avisar cuando se registre un nuevo equipo para evaluación.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Notificaciones Push (Navegador)</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Ventas Completadas</p>
                    <p className="text-xs text-gray-500">Mostrar notificación en pantalla al cerrar una venta.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-6 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 flex items-center gap-2 transition-colors">
                  <Save size={16} /> Guardar Cambios
                </motion.button>
              </div>
            </div>
          </motion.div>
        );
      case 'security':
        return (
          <motion.div 
            key="security"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-8 w-full"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-6">Seguridad de la Cuenta</h2>
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                  <Key size={16} /> Cambiar Contraseña
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Contraseña Actual</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Nueva Contraseña</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Confirmar Nueva Contraseña</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-shadow" />
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Actualizar Contraseña
                  </motion.button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                  <Lock size={16} /> Autenticación de Dos Factores (2FA)
                </h3>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Protege tu cuenta con 2FA</p>
                    <p className="text-xs text-gray-500 mt-1">Añade una capa extra de seguridad requiriendo un código además de tu contraseña.</p>
                  </div>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap">
                    Activar 2FA
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 'billing':
        return (
          <motion.div 
            key="billing"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-8 w-full"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-6">Facturación y Suscripción</h2>
            <div className="space-y-8">
              <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl text-white">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-gray-400 text-sm font-medium mb-1">Plan Actual</p>
                    <h3 className="text-2xl font-black">Pro Business</h3>
                  </div>
                  <span className="px-3 py-1 bg-white/10 text-white text-xs font-bold rounded-full">Activo</span>
                </div>
                <div className="flex items-end gap-2 mb-6">
                  <span className="text-4xl font-black">$49</span>
                  <span className="text-gray-400 text-sm mb-1">/ mes</span>
                </div>
                <div className="flex gap-4">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors">
                    Cambiar Plan
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors">
                    Cancelar
                  </motion.button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Método de Pago</h3>
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
                      <CreditCard size={20} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">•••• •••• •••• 4242</p>
                      <p className="text-xs text-gray-500">Expira 12/25</p>
                    </div>
                  </div>
                  <button className="text-sm font-medium text-gray-500 hover:text-gray-900">Editar</button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Historial de Facturas</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-gray-500">
                        <th className="px-4 py-3 font-medium">Fecha</th>
                        <th className="px-4 py-3 font-medium">Monto</th>
                        <th className="px-4 py-3 font-medium">Estado</th>
                        <th className="px-4 py-3 font-medium text-right">Factura</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-4 py-3 text-gray-900">01 Mar 2026</td>
                        <td className="px-4 py-3 text-gray-900">$49.00</td>
                        <td className="px-4 py-3"><span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-bold">Pagado</span></td>
                        <td className="px-4 py-3 text-right"><button className="text-gray-400 hover:text-gray-900"><Download size={16} /></button></td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-gray-900">01 Feb 2026</td>
                        <td className="px-4 py-3 text-gray-900">$49.00</td>
                        <td className="px-4 py-3"><span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-bold">Pagado</span></td>
                        <td className="px-4 py-3 text-right"><button className="text-gray-400 hover:text-gray-900"><Download size={16} /></button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 'integrations':
        return (
          <motion.div 
            key="integrations"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-8 w-full"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-6">Integraciones</h2>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-xl flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">WhatsApp Business API</h3>
                    <p className="text-xs text-gray-500 mt-1">Envía notificaciones automáticas a clientes sobre sus reparaciones o canjes.</p>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
                  Conectar
                </motion.button>
              </div>

              <div className="p-4 border border-gray-200 rounded-xl flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Mercado Pago</h3>
                    <p className="text-xs text-gray-500 mt-1">Sincroniza tus cobros y genera links de pago directamente desde la plataforma.</p>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors whitespace-nowrap flex items-center gap-2">
                  <Check size={16} /> Conectado
                </motion.button>
              </div>

              <div className="p-4 border border-gray-200 rounded-xl flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                    <LinkIcon size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">API Personalizada</h3>
                    <p className="text-xs text-gray-500 mt-1">Conecta tu propio e-commerce o sistema contable mediante nuestra API REST.</p>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
                  Generar Token
                </motion.button>
              </div>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col flex-1">
      <motion.div variants={item} className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Configuración</h1>
        <p className="text-gray-500 text-sm">Administra las preferencias y ajustes de tu cuenta.</p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-8 flex-1 overflow-hidden">
        {/* Sidebar Settings */}
        <motion.div variants={item} className="w-full md:w-64 shrink-0 space-y-1 overflow-x-auto md:overflow-visible flex md:block pb-2 md:pb-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(tab.id)}
                className={`w-auto md:w-full flex-shrink-0 md:flex-shrink flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors relative ${
                  isActive 
                    ? 'text-gray-900' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="settingsTab" 
                    className="absolute inset-0 bg-white shadow-sm border border-gray-200 rounded-xl" 
                    style={{ zIndex: -1 }}
                  />
                )}
                <Icon size={18} className={isActive ? 'text-gray-900 relative z-10' : 'text-gray-400 relative z-10'} />
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Content Area */}
        <motion.div variants={item} className="flex-1 max-w-3xl bg-white border border-gray-200 rounded-2xl overflow-y-auto relative">
          <AnimatePresence mode="wait">
            {renderTabContent()}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
};
