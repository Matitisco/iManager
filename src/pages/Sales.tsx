import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { TrendingUp, BarChart, X, Filter, ChevronDown, ChevronUp, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { Client, Product, Sale } from '../types';
import { motion, AnimatePresence, Variants } from 'motion/react';
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

export const Sales: React.FC = () => {
  const { sales, clients, inventory, deleteSale } = useAppContext();
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string>('Todas');
  const [filterClient, setFilterClient] = useState<string>('Todos');
  const [filterModel, setFilterModel] = useState<string>('Todos');
  const [filterPayment, setFilterPayment] = useState<string>('Todos');
  const [showFilters, setShowFilters] = useState(false);

  const getClient = (clientId: string): Client | undefined => clients.find((client) => client.id === clientId);
  const getProduct = (productId: string): Product | undefined => inventory.find((product) => product.id === productId);

  const uniqueClients = Array.from(new Set(sales.map(s => s.clientId))).sort();
  const uniqueModels = Array.from(new Set(sales.map(s => s.productId))).sort();
  const uniquePayments = Array.from(new Set(sales.map(s => s.paymentMethod))).sort();

  const filteredSales = sales.filter(sale => {
    if (filterDate !== 'Todas' && sale.date !== filterDate) return false;
    if (filterClient !== 'Todos' && sale.clientId !== filterClient) return false;
    if (filterModel !== 'Todos' && sale.productId !== filterModel) return false;
    if (filterPayment !== 'Todos' && sale.paymentMethod !== filterPayment) return false;
    return true;
  });

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const averageTicket = sales.length > 0 ? totalRevenue / sales.length : 0;
  const totalMarginAmount = sales.reduce((sum, sale) => {
    const product = getProduct(sale.productId);
    return sum + (product ? sale.amount - product.cost : 0);
  }, 0);
  const marginRate = totalRevenue > 0 ? (totalMarginAmount / totalRevenue) * 100 : 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col lg:flex-row gap-6 flex-1 relative">
      <div className="flex-1 flex flex-col space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div variants={item}>
            <StatCard title="FACTURACIÓN TOTAL" value={formatCurrency(totalRevenue)} trend={`${sales.length} ventas`} icon={<TrendingUp size={16} className="text-emerald-500" />} />
          </motion.div>
          <motion.div variants={item}>
            <StatCard title="TICKET PROMEDIO" value={formatCurrency(averageTicket)} trend={sales.length > 0 ? 'Datos reales' : 'Sin ventas'} icon={<BarChart size={16} className="text-gray-400" />} />
          </motion.div>
          <motion.div variants={item}>
            <StatCard title="MARGEN BRUTO ESTIMADO" value={`${marginRate.toFixed(1)}%`} trend={formatCurrency(totalMarginAmount)} />
          </motion.div>
        </div>

        <motion.div variants={item} className="bg-white border border-gray-200 rounded-2xl flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-2xl z-10 relative">
            <h2 className="text-lg font-bold text-gray-900">Ventas Registradas</h2>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white">
                {filteredSales.length} resultado{filteredSales.length === 1 ? '' : 's'}
              </span>
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
                            setFilterModel('Todos');
                            setFilterPayment('Todos');
                          }}
                          className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                        >
                          Limpiar
                        </button>
                      </div>
                      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                        <FilterField label="Fecha" value={filterDate} onChange={setFilterDate}>
                          <option value="Todas">Todas</option>
                          {Array.from(new Set(sales.map(s => s.date))).sort().map(date => (
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

                        <FilterField label="Modelo" value={filterModel} onChange={setFilterModel}>
                          <option value="Todos">Todos</option>
                          {uniqueModels.map(productId => {
                            const product = getProduct(productId);
                            return (
                              <option key={productId} value={productId}>
                                {product ? `${product.model} - ${product.capacity}` : `Producto ${productId}`}
                              </option>
                            );
                          })}
                        </FilterField>

                        <FilterField label="Método de Pago" value={filterPayment} onChange={setFilterPayment}>
                          <option value="Todos">Todos</option>
                          {uniquePayments.map(payment => (
                            <option key={payment} value={payment}>{payment}</option>
                          ))}
                        </FilterField>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50">
                <tr className="text-gray-400 text-xs font-bold tracking-wider uppercase border-b border-gray-200">
                  <th className="px-6 py-4">ID Venta</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Modelo / IMEI</th>
                  <th className="px-6 py-4">Monto</th>
                  <th className="px-6 py-4">Pago</th>
                  <th className="px-6 py-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">
                      Todavía no hay ventas para mostrar con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const client = getClient(sale.clientId);
                    const product = getProduct(sale.productId);

                    return (
                      <tr
                        key={sale.id}
                        onClick={() => setEditingSale(sale)}
                        className="hover:bg-gray-50 transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4 font-bold text-gray-900">{sale.id}</td>
                        <td className="px-6 py-4 text-gray-500">{sale.date}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {client?.name || 'Cliente eliminado'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">
                            {product ? `${product.model} ${product.capacity}` : 'Producto eliminado'}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            IMEI: {product?.imei || 'No disponible'}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">
                          {formatCurrency(sale.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-bold rounded-md uppercase tracking-wide ${
                            sale.paymentMethod === 'TRANSFERENCIA' ? 'bg-gray-100 text-gray-600' :
                            sale.paymentMethod === 'EFECTIVO' ? 'bg-black text-white' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <ActionMenu
                              onEdit={() => setEditingSale(sale)}
                              onDelete={() => setSaleToDelete(sale.id)}
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
            Mostrando {filteredSales.length} venta{filteredSales.length === 1 ? '' : 's'}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {editingSale && (
          <SaleEditPanel sale={editingSale} onClose={() => setEditingSale(null)} />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!saleToDelete}
        title="Eliminar Venta"
        message="¿Está seguro de que desea eliminar esta venta? Se revertirá el stock del producto y el total gastado del cliente."
        onConfirm={() => {
          if (saleToDelete) {
            deleteSale(saleToDelete);
          }
        }}
        onCancel={() => setSaleToDelete(null)}
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
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);

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
              className="fixed w-40 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden z-50"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); onEdit(); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit2 size={14} />
                Editar venta
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
    className="bg-white p-5 rounded-2xl border border-gray-200 h-full transition-shadow cursor-default"
  >
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-xs font-bold text-gray-400 tracking-wider">{title}</h3>
      {icon}
    </div>
    <div className="text-3xl font-black text-gray-900 mb-2">{value}</div>
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-bold text-gray-500">{trend}</span>
    </div>
  </motion.div>
);

const SaleEditPanel = ({ sale, onClose }: { sale: Sale, onClose: () => void }) => {
  const { updateSale } = useAppContext();
  const [formData, setFormData] = useState<Sale>(sale);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(sale);
  }, [sale]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await updateSale(formData);
      onClose();
    } catch (submitError) {
      setError(getFriendlyErrorMessage(submitError, 'No se pudo actualizar la venta.'));
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
              <h2 className="text-lg font-bold text-gray-900">Editar Seguimiento</h2>
              <p className="text-xs text-gray-500 font-mono">{sale.id}</p>
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
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fecha</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
                placeholder="ej. 2 abr 2026"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Monto</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
                min={0}
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Estado</label>
              <select
                name="status"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Sale['status'] }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              >
                <option value="COMPLETADA">COMPLETADA</option>
                <option value="PENDIENTE">PENDIENTE</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Método de Pago</label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as Sale['paymentMethod'] }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-colors"
              >
                <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                <option value="EFECTIVO">EFECTIVO</option>
                <option value="TARJETA">TARJETA</option>
                <option value="CANJE / PAGO">CANJE / PAGO</option>
                <option value="T. Crédito">T. Crédito</option>
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
