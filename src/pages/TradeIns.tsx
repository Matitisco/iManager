import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { AlertCircle, Banknote, Calculator, CheckCircle2, Filter, Download, MoreVertical, ChevronDown, ChevronUp, X, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { Client, TradeIn } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatCurrency, getFriendlyErrorMessage } from '../lib/utils';

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

export const TradeIns: React.FC = () => {
  const { tradeIns, clients, deleteTradeIn } = useAppContext();
  const [filterDate, setFilterDate] = useState<string>('Todas');
  const [filterClient, setFilterClient] = useState<string>('Todos');
  const [filterDevice, setFilterDevice] = useState<string>('Todos');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTradeIn, setSelectedTradeIn] = useState<TradeIn | null>(null);
  const [tradeInToDelete, setTradeInToDelete] = useState<string | null>(null);

  const getClient = (clientId: string): Client | undefined => clients.find((client) => client.id === clientId);

  const uniqueClients = Array.from(new Set(tradeIns.map(t => t.clientId))).sort();
  const uniqueDevices = Array.from(new Set(tradeIns.map(t => t.deviceReceived))).sort();
  const uniqueStatuses = Array.from(new Set(tradeIns.map(t => t.status))).sort();

  const filteredTradeIns = tradeIns.filter(trade => {
    if (filterDate !== 'Todas' && trade.date !== filterDate) return false;
    if (filterClient !== 'Todos' && trade.clientId !== filterClient) return false;
    if (filterDevice !== 'Todos' && trade.deviceReceived !== filterDevice) return false;
    if (filterStatus !== 'Todos' && trade.status !== filterStatus) return false;
    return true;
  });

  const pendingTradeIns = tradeIns.filter(trade => ['PENDIENTE', 'EN REVISIÓN', 'PERITAJE TÉC.'].includes(trade.status)).length;
  const totalTakeValue = tradeIns.reduce((sum, trade) => sum + trade.takeValue, 0);
  const averageDifference = tradeIns.length > 0 ? tradeIns.reduce((sum, trade) => sum + trade.differencePaid, 0) / tradeIns.length : 0;
  const approvedTradeIns = tradeIns.filter(trade => trade.status === 'APROBADO').length;
  const approvalRate = tradeIns.length > 0 ? (approvedTradeIns / tradeIns.length) * 100 : 0;
  const highlightedTradeIns = useMemo(() => tradeIns.slice(0, 3), [tradeIns]);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4">
        <p className="text-sm font-semibold">Modo tester:</p>
        <p className="text-sm mt-1">
          El historial de canjes ya usa datos reales. La franja superior ahora toma casos reales recientes, pero todavía no existe un workflow avanzado de peritaje ni exportación.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item}><StatCard title="CANJES EN EVALUACIÓN" value={String(pendingTradeIns)} trend={`${tradeIns.length} totales`} icon={<AlertCircle size={16} className="text-amber-500" />} /></motion.div>
        <motion.div variants={item}><StatCard title="VALOR RECIBIDO" value={formatCurrency(totalTakeValue)} trend="Datos reales" icon={<Banknote size={16} className="text-emerald-500" />} /></motion.div>
        <motion.div variants={item}><StatCard title="PROMEDIO DIFERENCIA" value={formatCurrency(averageDifference)} trend="Datos reales" icon={<Calculator size={16} className="text-blue-500" />} /></motion.div>
        <motion.div variants={item}><StatCard title="TASA APROBACIÓN" value={`${approvalRate.toFixed(0)}%`} trend={`${approvedTradeIns} aprobados`} icon={<CheckCircle2 size={16} className="text-gray-900" />} /></motion.div>
      </div>

      <motion.div variants={item}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-lg font-bold text-gray-900">Canjes recientes</h2>
          <span className="text-sm text-gray-500">Los cards muestran registros cargados en Firestore.</span>
        </div>
        {highlightedTradeIns.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center text-gray-500">
            Todavía no hay canjes registrados para mostrar.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {highlightedTradeIns.map((trade) => (
              <EvaluationCard
                key={trade.id}
                trade={trade}
                client={getClient(trade.clientId)}
                onOpen={() => setSelectedTradeIn(trade)}
              />
            ))}
          </div>
        )}
      </motion.div>

      <motion.div variants={item} className="bg-white border border-gray-200 rounded-2xl">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-2xl z-10 relative">
          <h2 className="text-lg font-bold text-gray-900">Historial de Canjes</h2>
          <div className="flex items-center gap-2">
            <button className="p-2 border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed bg-white" disabled>
              <Download size={18} />
            </button>
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
                    className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-gray-900">Filtros</h3>
                      <button 
                        onClick={() => {
                          setFilterDate('Todas');
                          setFilterClient('Todos');
                          setFilterDevice('Todos');
                          setFilterStatus('Todos');
                        }}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        Limpiar
                      </button>
                    </div>
                    <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                      <FilterField label="Fecha" value={filterDate} onChange={setFilterDate}>
                        <option value="Todas">Todas</option>
                        {Array.from(new Set(tradeIns.map(t => t.date))).sort().map(date => (
                          <option key={date} value={date}>{date}</option>
                        ))}
                      </FilterField>

                      <FilterField label="Cliente" value={filterClient} onChange={setFilterClient}>
                        <option value="Todos">Todos</option>
                        {uniqueClients.map(clientId => {
                          const client = getClient(clientId);
                          return (
                            <option key={clientId} value={clientId}>
                              {client ? `${client.name} (${client.dni})` : `Cliente ${clientId}`}
                            </option>
                          );
                        })}
                      </FilterField>

                      <FilterField label="Equipo Recibido" value={filterDevice} onChange={setFilterDevice}>
                        <option value="Todos">Todos</option>
                        {uniqueDevices.map(device => (
                          <option key={device} value={device}>{device}</option>
                        ))}
                      </FilterField>

                      <FilterField label="Estado" value={filterStatus} onChange={setFilterStatus}>
                        <option value="Todos">Todos</option>
                        {uniqueStatuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </FilterField>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50">
              <tr className="text-gray-400 text-xs font-bold tracking-wider uppercase border-b border-gray-200">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Equipo Recibido / IMEI</th>
                <th className="px-6 py-4">Valor Toma</th>
                <th className="px-6 py-4">Equipo Entregado</th>
                <th className="px-6 py-4">Dif. Abonada</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTradeIns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">
                    No hay canjes para mostrar con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredTradeIns.map((trade) => {
                  const client = getClient(trade.clientId);

                  return (
                    <tr key={trade.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 text-gray-500">{trade.date}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{client?.name || 'Cliente eliminado'}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{client?.dni || 'Sin DNI'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{trade.deviceReceived}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{trade.deviceReceivedImei}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(trade.takeValue)}</td>
                      <td className="px-6 py-4 text-gray-500">{trade.deviceGiven}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(trade.differencePaid)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-[10px] font-bold rounded uppercase tracking-wide ${
                          trade.status === 'APROBADO' ? 'bg-emerald-100 text-emerald-800' :
                          trade.status === 'RECHAZADO' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {trade.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <ActionMenu 
                            onEdit={() => setSelectedTradeIn(trade)} 
                            onDelete={() => setTradeInToDelete(trade.id)} 
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200 text-sm text-gray-500 bg-white rounded-b-2xl">
          Mostrando {filteredTradeIns.length} canje{filteredTradeIns.length === 1 ? '' : 's'}
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedTradeIn && (
          <TradeInEditPanel tradeIn={selectedTradeIn} onClose={() => setSelectedTradeIn(null)} />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!tradeInToDelete}
        title="Eliminar Canje"
        message="¿Está seguro de que desea eliminar este canje? Esta acción no se puede deshacer."
        onConfirm={() => {
          if (tradeInToDelete) {
            deleteTradeIn(tradeInToDelete);
          }
        }}
        onCancel={() => setTradeInToDelete(null)}
      />
    </motion.div>
  );
};

const FilterField = ({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors appearance-none"
    >
      {children}
    </select>
  </div>
);

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

const StatCard = ({ title, value, trend, icon }: any) => (
  <motion.div 
    whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
    className="bg-white p-5 rounded-2xl border border-gray-200 transition-shadow cursor-default h-full"
  >
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-xs font-bold text-gray-400 tracking-wider">{title}</h3>
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
        {icon}
      </div>
    </div>
    <div className="flex items-end gap-2">
      <div className="text-3xl font-black text-gray-900 leading-none">{value}</div>
    </div>
    <span className="inline-block mt-2 text-xs font-bold text-gray-500">{trend}</span>
  </motion.div>
);

const EvaluationCard = ({
  trade,
  client,
  onOpen,
}: {
  trade: TradeIn;
  client?: Client;
  onOpen: () => void;
}) => (
  <motion.button
    whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
    onClick={onOpen}
    className="bg-white p-4 rounded-2xl border border-gray-200 flex gap-4 transition-shadow text-left"
  >
    <div className="w-20 h-24 rounded-xl bg-gray-900/5 shrink-0 border border-gray-100 shadow-inner flex items-center justify-center text-gray-500 text-xs font-bold px-2 text-center">
      {trade.deviceReceived}
    </div>
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-1 gap-3">
          <h3 className="font-bold text-gray-900">{trade.deviceReceived}</h3>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide ${
            trade.status === 'LISTO' ? 'bg-emerald-100 text-emerald-800' :
            trade.status === 'EN REVISIÓN' ? 'bg-amber-100 text-amber-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {trade.status}
          </span>
        </div>
        <div className="text-xs text-gray-500 space-y-0.5">
          <div className="flex justify-between gap-3">
            <span>Cliente:</span>
            <span className="font-medium text-gray-900 text-right">{client?.name || 'Sin cliente'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Batería:</span>
            <span className="font-medium text-gray-900">{trade.batteryHealth ? `${trade.batteryHealth}%` : 'N/D'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Grado:</span>
            <span className="font-medium text-gray-900">{trade.grade || 'N/D'}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">Valor estimado</span>
        <span className="font-black text-gray-900">{formatCurrency(trade.takeValue)}</span>
      </div>
    </div>
  </motion.button>
);

const TradeInEditPanel = ({ tradeIn, onClose }: { tradeIn: TradeIn, onClose: () => void }) => {
  const { updateTradeIn, clients } = useAppContext();
  const [formData, setFormData] = useState(tradeIn);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(tradeIn);
  }, [tradeIn]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'takeValue' || name === 'differencePaid' || name === 'batteryHealth' ? Number(value) : value
    }));
  };

  const handleSave = async () => {
    if (!formData.deviceReceived.trim() || !formData.deviceReceivedImei.trim() || !formData.deviceGiven.trim()) {
      setError('Completá equipo recibido, IMEI y equipo entregado antes de guardar.');
      return;
    }

    if (!Number.isFinite(formData.takeValue) || formData.takeValue < 0 || !Number.isFinite(formData.differencePaid)) {
      setError('Los importes deben ser números válidos.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateTradeIn(formData);
      onClose();
    } catch (submitError) {
      setError(getFriendlyErrorMessage(submitError, 'No se pudo guardar el canje.'));
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
              <h2 className="text-lg font-bold text-gray-900">Editar Canje</h2>
              <p className="text-xs text-gray-500 font-mono">{tradeIn.id}</p>
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
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cliente</label>
              <select
                name="clientId"
                value={formData.clientId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              >
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.dni})</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Equipo Recibido</label>
              <input
                type="text"
                name="deviceReceived"
                value={formData.deviceReceived}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">IMEI Recibido</label>
              <input
                type="text"
                name="deviceReceivedImei"
                value={formData.deviceReceivedImei}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Valor Tomado</label>
              <input
                type="number"
                name="takeValue"
                value={formData.takeValue}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Equipo Entregado</label>
              <input
                type="text"
                name="deviceGiven"
                value={formData.deviceGiven}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Diferencia Pagada</label>
              <input
                type="number"
                name="differencePaid"
                value={formData.differencePaid}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Estado</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              >
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="EN REVISIÓN">EN REVISIÓN</option>
                <option value="PERITAJE TÉC.">PERITAJE TÉC.</option>
                <option value="LISTO">LISTO</option>
                <option value="APROBADO">APROBADO</option>
                <option value="RECHAZADO">RECHAZADO</option>
              </select>
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
