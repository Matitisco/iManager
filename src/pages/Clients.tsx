import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Users, UserCheck, Wallet, Ticket, Filter, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatCurrency, getFriendlyErrorMessage } from '../lib/utils';
import { Client } from '../types';

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

export const Clients: React.FC = () => {
  const { clients, sales, deleteClient, updateClient } = useAppContext();
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [filterLastPurchase, setFilterLastPurchase] = useState<string>('Todas');
  const [filterBalance, setFilterBalance] = useState<string>('Todos');
  const [showFilters, setShowFilters] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const hasClientActivity = (client: (typeof clients)[number]) => client.totalSpent > 0 || client.lastPurchaseDate !== 'N/A';

  const uniqueLastPurchases = Array.from(new Set(clients.map(c => c.lastPurchaseDate).filter(date => date !== 'N/A'))).sort();

  const filteredClients = clients.filter(client => {
    if (filterStatus === 'Activos' && !hasClientActivity(client)) return false;
    if (filterStatus === 'Inactivos' && hasClientActivity(client)) return false;
    if (filterLastPurchase !== 'Todas' && client.lastPurchaseDate !== filterLastPurchase) return false;
    if (filterBalance === 'Con Deuda' && client.pendingBalance === 0) return false;
    if (filterBalance === 'Sin Deuda' && client.pendingBalance > 0) return false;
    return true;
  });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const totalClients = clients.length;
  const clientsWithActivity = clients.filter(hasClientActivity).length;
  const totalPendingBalance = clients.reduce((sum, client) => sum + client.pendingBalance, 0);
  const averageTicket = sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.amount, 0) / sales.length : 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header Info */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Gestión de Clientes</h1>
        <p className="text-gray-500 text-sm">Visualiza y administra la base de datos central de tus clientes.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item}><StatCard title="Total Clientes" value={String(totalClients)} trend="Datos reales" icon={<Users size={18} className="text-gray-400" />} /></motion.div>
        <motion.div variants={item}><StatCard title="Clientes con actividad" value={String(clientsWithActivity)} trend={sales.length > 0 ? 'Basado en ventas' : 'Sin ventas'} icon={<UserCheck size={18} className="text-gray-400" />} /></motion.div>
        <motion.div variants={item}><StatCard title="Saldo Pendiente Total" value={formatCurrency(totalPendingBalance)} trend={totalPendingBalance > 0 ? 'Deuda real' : 'Sin deuda'} trendDown={totalPendingBalance > 0} icon={<Wallet size={18} className="text-gray-400" />} /></motion.div>
        <motion.div variants={item}><StatCard title="Ticket Promedio" value={formatCurrency(averageTicket)} trend={sales.length > 0 ? 'Datos reales' : 'Sin ventas'} icon={<Ticket size={18} className="text-gray-400" />} /></motion.div>
      </div>

      {/* Table */}
      <motion.div variants={item} className="bg-white border border-gray-200 rounded-2xl flex flex-col">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-t-2xl z-10 relative">
          <div className="flex flex-wrap gap-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 flex items-center gap-2 transition-colors shadow-sm">
              <Download size={16} /> Exportar
            </motion.button>
            <div className="relative">
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showFilters ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <Filter size={16} />
                <span className="hidden sm:inline">Filtros</span>
                {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </motion.button>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    key="filters-panel"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-gray-900">Filtros</h3>
                      <button 
                        onClick={() => {
                          setFilterStatus('Todos');
                          setFilterLastPurchase('Todas');
                          setFilterBalance('Todos');
                        }}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        Limpiar
                      </button>
                    </div>
                    <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</label>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none"
                        >
                          <option value="Todos">Todos</option>
                        <option value="Activos">Activos</option>
                        <option value="Inactivos">Inactivos</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Última Compra</label>
                        <select
                          value={filterLastPurchase}
                          onChange={(e) => setFilterLastPurchase(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none"
                        >
                          <option value="Todas">Todas</option>
                          {uniqueLastPurchases.map(date => (
                            <option key={date} value={date}>{date}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Saldo Pendiente</label>
                        <select
                          value={filterBalance}
                          onChange={(e) => setFilterBalance(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none"
                        >
                          <option value="Todos">Todos</option>
                          <option value="Con Deuda">Con Deuda</option>
                          <option value="Sin Deuda">Sin Deuda</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Mostrando <span className="font-bold text-gray-900">{filteredClients.length}</span> de <span className="font-bold text-gray-900">{clients.length}</span> clientes
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50">
              <tr className="text-gray-400 text-xs font-bold tracking-wider uppercase border-b border-gray-200">
                <th className="px-6 py-4">ID/DNI</th>
                <th className="px-6 py-4">Nombre</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Teléfono</th>
                <th className="px-6 py-4">Última Compra</th>
                <th className="px-6 py-4">Total Gastado</th>
                <th className="px-6 py-4 text-right">Saldo Pendiente</th>
                <th className="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">
                    No hay clientes para mostrar con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className="hover:bg-gray-50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium text-gray-500">{client.dni}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{client.name}</td>
                    <td className="px-6 py-4 text-gray-500">{client.email}</td>
                    <td className="px-6 py-4 text-gray-500">{client.phone}</td>
                    <td className="px-6 py-4 text-gray-500">{client.lastPurchaseDate}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(client.totalSpent)}</td>
                    <td className="px-6 py-4 font-bold text-right">
                      {client.pendingBalance > 0 ? (
                        <span className="text-red-600">{formatCurrency(client.pendingBalance)}</span>
                      ) : (
                        <span className="text-gray-900">{formatCurrency(0)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <ActionMenu
                          onEdit={() => setSelectedClient(client)}
                          onDelete={() => setClientToDelete(client.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-b-2xl">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto justify-center px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 flex items-center gap-1 transition-colors">
            <ChevronLeft size={16} /> Anterior
          </motion.button>
          <div className="flex flex-wrap items-center justify-center gap-1">
            <button className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm font-medium bg-black text-white">1</button>
            <button className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">2</button>
            <button className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">3</button>
            <span className="px-2 text-gray-400">...</span>
            <button className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">12</button>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto justify-center px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 flex items-center gap-1 transition-colors">
            Siguiente <ChevronRight size={16} />
          </motion.button>
        </div>
      </motion.div>

      <ConfirmModal
        isOpen={!!clientToDelete}
        title="Eliminar Cliente"
        message="¿Está seguro de que desea eliminar este cliente? Esta acción no se puede deshacer."
        onConfirm={() => {
          if (clientToDelete) {
            deleteClient(clientToDelete);
          }
        }}
        onCancel={() => setClientToDelete(null)}
      />

      <AnimatePresence>
        {selectedClient && (
          <ClientEditPanel
            client={selectedClient}
            onClose={() => setSelectedClient(null)}
            onSave={async (updated) => { await updateClient(updated); setSelectedClient(null); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ActionMenu = ({ onEdit, onDelete }: { onEdit: () => void, onDelete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setIsOpen(prev => !prev);
  };

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreVertical size={16} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              style={{ top: menuPos.top, right: menuPos.right }}
              className="fixed w-32 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden z-50"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); onEdit(); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 size={14} />
                Editar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); onDelete(); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={14} />
                Eliminar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const ClientEditPanel = ({
  client,
  onClose,
  onSave,
}: {
  client: Client;
  onClose: () => void;
  onSave: (updated: Client) => Promise<void>;
}) => {
  const [formData, setFormData] = useState(client);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(client);
  }, [client]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'pendingBalance' ? Number(value) : value,
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(formData);
    } catch (submitError) {
      setError(getFriendlyErrorMessage(submitError, 'No se pudo actualizar el cliente.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col border-l border-gray-200"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <Edit2 size={18} className="text-gray-900" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Editar Cliente</h2>
              <p className="text-xs text-gray-500 font-mono">{client.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nombre</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">DNI</label>
              <input
                type="text"
                name="dni"
                value={formData.dni}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Teléfono</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Saldo Pendiente</label>
              <input
                type="number"
                name="pendingBalance"
                value={formData.pendingBalance}
                onChange={handleChange}
                min={0}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Gastado</label>
              <input
                type="text"
                value={formatCurrency(formData.totalSpent)}
                readOnly
                className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Última Compra</label>
              <input
                type="text"
                value={formData.lastPurchaseDate}
                readOnly
                className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-white transition-colors"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </motion.div>
    </>
  );
};

const StatCard = ({ title, value, trend, trendDown = false, icon }: any) => (
  <motion.div 
    whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
    className="bg-white p-5 rounded-2xl border border-gray-200 transition-shadow cursor-default h-full"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-2">
        {icon}
      </div>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trendDown ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
        {trend}
      </span>
    </div>
    <div className="text-sm text-gray-500 font-medium mb-1">{title}</div>
    <div className="text-3xl font-black text-gray-900">{value}</div>
  </motion.div>
);
