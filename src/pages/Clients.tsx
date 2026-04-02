import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Users, UserCheck, Wallet, Ticket, Filter, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatCurrency } from '../lib/utils';

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
  const { clients, sales, deleteClient } = useAppContext();
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
  const [selectedClient, setSelectedClient] = useState<any>(null);

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
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors group">
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
                    <td className="px-6 py-4">
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
    </motion.div>
  );
};

const ActionMenu = ({ onEdit, onDelete }: { onEdit: () => void, onDelete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
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
              className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden z-50"
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
