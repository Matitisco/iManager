import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { TrendingUp, BarChart, X, CheckCircle2, Printer, Share2, Filter, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { Sale } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export const Sales: React.FC = () => {
  const { sales } = useAppContext();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col lg:flex-row gap-6 flex-1 relative">
      <div className="flex-1 flex flex-col space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div variants={item}><StatCard title="VENTAS TOTALES MES" value="$125.400,00" trend="+12.5%" icon={<TrendingUp size={16} className="text-emerald-500" />} /></motion.div>
          <motion.div variants={item}><StatCard title="TICKET PROMEDIO" value="$850,00" trend="-2.1%" trendDown icon={<BarChart size={16} className="text-gray-400" />} /></motion.div>
          <motion.div variants={item}><StatCard title="MARGEN TOTAL" value="24.5%" trend="+5.0%" /></motion.div>
        </div>

        {/* Table */}
        <motion.div variants={item} className="bg-white border border-gray-200 rounded-2xl flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-2xl z-10 relative">
            <h2 className="text-lg font-bold text-gray-900">Ventas Recientes</h2>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-colors bg-white">
                Últimos 30 días
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
                        <button className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Limpiar</button>
                      </div>
                      <div className="p-4 space-y-4">
                        <FilterSelect label="Fecha: Todas" />
                        <FilterSelect label="Cliente: Todos" />
                        <FilterSelect label="Modelo: Todos" />
                        <FilterSelect label="Método de Pago: Todos" />
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
                  <th className="px-6 py-4">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedSale?.id === sale.id ? 'bg-gray-50' : ''}`}
                    onClick={() => setSelectedSale(sale)}
                  >
                    <td className="px-6 py-4 font-bold text-gray-900">{sale.id}</td>
                    <td className="px-6 py-4 text-gray-500">{sale.date}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {sale.clientId === '1' ? 'Juan Pérez' : sale.clientId === '2' ? 'María García' : sale.clientId === '3' ? 'Pedro Sánchez' : sale.clientId === '4' ? 'Elena Martínez' : 'Roberto Jiménez'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">
                        {sale.productId === '1' ? 'iPhone 15 Pro Max' : sale.productId === '2' ? 'iPhone 14' : sale.productId === '3' ? 'iPhone 15 Pro' : sale.productId === '4' ? 'iPhone 13' : 'iPhone 15'}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">IMEI: 354678129034567</div>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-200 text-sm text-gray-500 bg-white rounded-b-2xl">
            Mostrando {sales.length} ventas
          </div>
        </motion.div>
      </div>

      {/* Slide-over Details */}
      <AnimatePresence>
        {selectedSale && (
          <motion.div 
            key="sale-details"
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full lg:w-96 absolute inset-0 lg:relative bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-lg z-20"
          >
            <div className="p-6 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Detalle de Venta</h2>
                <p className="text-sm text-gray-500 mt-1">ID: {selectedSale.id} • {selectedSale.date}</p>
              </div>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedSale(null)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </motion.button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-8">
              {/* Cliente */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-3">Información del Cliente</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium">
                    JP
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">Juan Pérez</div>
                    <div className="text-sm text-gray-500">juan.perez@email.com</div>
                    <div className="text-sm text-gray-500">+54 11 4455-6677</div>
                  </div>
                </div>
              </div>

              {/* Producto */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-3">Producto Vendido</h3>
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-gray-900">iPhone 15 Pro Max</div>
                    <div className="font-black text-gray-900">${selectedSale.amount.toLocaleString()}</div>
                  </div>
                  <div className="text-sm text-gray-500 mb-2">Capacidad: 256GB • Color: Titanio Natural</div>
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-400">IMEI: 354678129034567</div>
                    <div className="text-xs font-bold text-emerald-600">Stock: Disponible</div>
                  </div>
                </div>
              </div>

              {/* Desglose */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-3">Desglose de Pago</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>${(selectedSale.amount * 0.79).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>IVA (21%)</span>
                    <span>${(selectedSale.amount * 0.21).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100 mt-2">
                    <span>Total Cobrado</span>
                    <span>${selectedSale.amount.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex gap-2 items-start">
                  <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-xs text-emerald-700 font-medium leading-relaxed">
                    Pago verificado vía {selectedSale.paymentMethod}
                  </span>
                </div>
              </div>

              {/* Notas */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-3">Notas Internas</h3>
                <textarea 
                  className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm text-gray-900 placeholder-gray-400 resize-none h-24 focus:ring-2 focus:ring-black outline-none transition-shadow"
                  placeholder="Agregar una nota sobre esta venta..."
                ></textarea>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3 bg-white">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                <Printer size={16} /> Ticket
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 py-2.5 bg-black text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
                <Share2 size={16} /> Enviar PDF
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FilterSelect = ({ label }: { label: string }) => {
  const [key, value] = label.split(': ');
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{key}</label>
      <button className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center justify-between transition-colors">
        <span className="text-gray-500">{value}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
    </div>
  );
};

const StatCard = ({ title, value, trend, trendDown = false, icon }: any) => (
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
      <span className={`text-xs font-bold ${trendDown ? 'text-red-600' : 'text-emerald-600'}`}>
        {trend}
      </span>
      <span className="text-xs text-gray-400 font-medium">vs. mes anterior</span>
    </div>
  </motion.div>
);
