import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { AlertCircle, Banknote, Calculator, CheckCircle2, Filter, Download, MoreVertical, ChevronDown, ChevronUp, ChevronRight, X } from 'lucide-react';
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

export const TradeIns: React.FC = () => {
  const { tradeIns } = useAppContext();
  const [showFilters, setShowFilters] = useState(false);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item}><StatCard title="CANJES EN EVALUACIÓN" value="12" trend="+5%" icon={<AlertCircle size={16} className="text-amber-500" />} /></motion.div>
        <motion.div variants={item}><StatCard title="VALOR RECIBIDO (MES)" value="$15,400" trend="-2%" trendDown icon={<Banknote size={16} className="text-emerald-500" />} /></motion.div>
        <motion.div variants={item}><StatCard title="PROMEDIO DIFERENCIA" value="$1,250" trend="+8%" icon={<Calculator size={16} className="text-blue-500" />} /></motion.div>
        <motion.div variants={item}><StatCard title="TASA APROBACIÓN" value="84%" trend="+1%" icon={<CheckCircle2 size={16} className="text-gray-900" />} /></motion.div>
      </div>

      {/* Evaluaciones en Curso */}
      <motion.div variants={item}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-lg font-bold text-gray-900">Evaluaciones en Curso</h2>
          <div className="flex flex-wrap gap-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 flex items-center gap-2 transition-colors">
              Grado B <Filter size={14} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 flex items-center gap-2 transition-colors">
              Todos los modelos <Filter size={14} />
            </motion.button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <EvaluationCard 
            model="iPhone 13 Pro" 
            status="EN REVISIÓN" 
            battery="88%" 
            grade="Grado B" 
            price="$450.00" 
            imgColor="bg-gray-800"
          />
          <EvaluationCard 
            model="iPhone 12 128GB" 
            status="LISTO" 
            battery="92%" 
            grade="Grado A" 
            price="$320.00" 
            imgColor="bg-blue-800"
          />
          <EvaluationCard 
            model="iPhone 14 Pro Max" 
            status="PERITAJE TÉC." 
            battery="95%" 
            grade="Grado A+" 
            price="$780.00" 
            imgColor="bg-yellow-200"
          />
        </div>
      </motion.div>

      {/* Historial */}
      <motion.div variants={item} className="bg-white border border-gray-200 rounded-2xl">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-2xl z-10 relative">
          <h2 className="text-lg font-bold text-gray-900">Historial de Canjes</h2>
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors bg-white">
              <Download size={18} />
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
                    className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-gray-900">Filtros</h3>
                      <button className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Limpiar</button>
                    </div>
                    <div className="p-4 space-y-4">
                      <FilterSelect label="Fecha: Todas" />
                      <FilterSelect label="Cliente: Todos" />
                      <FilterSelect label="Equipo Recibido: Todos" />
                      <FilterSelect label="Estado: Todos" />
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
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tradeIns.map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-500">{trade.date}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">
                      {trade.clientId === '1' ? 'Andrés Mendoza' : trade.clientId === '2' ? 'Lucía Fernandini' : 'Roberto Gómez'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">DNI 45892xxx</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{trade.deviceReceived}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{trade.deviceReceivedImei}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">${trade.takeValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-gray-500">{trade.deviceGiven}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">${trade.differencePaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-[10px] font-bold rounded uppercase tracking-wide ${
                      trade.status === 'APROBADO' ? 'bg-emerald-100 text-emerald-800' :
                      trade.status === 'RECHAZADO' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {trade.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-200 flex items-center justify-center sm:justify-end bg-white rounded-b-2xl">
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1">
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors whitespace-nowrap">Anterior</button>
            <button className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm font-medium bg-black text-white">1</button>
            <button className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">2</button>
            <button className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">3</button>
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors whitespace-nowrap">Siguiente</button>
          </div>
        </div>
      </motion.div>
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
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded mb-1 ${trendDown ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
        {trend}
      </span>
    </div>
  </motion.div>
);

const EvaluationCard = ({ model, status, battery, grade, price, imgColor }: any) => (
  <motion.div 
    whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
    className="bg-white p-4 rounded-2xl border border-gray-200 flex gap-4 transition-shadow cursor-pointer"
  >
    <div className={`w-20 h-24 rounded-xl ${imgColor} shrink-0 border border-gray-100 shadow-inner`}></div>
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-gray-900">{model}</h3>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide ${
            status === 'LISTO' ? 'bg-emerald-100 text-emerald-800' :
            status === 'EN REVISIÓN' ? 'bg-amber-100 text-amber-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {status}
          </span>
        </div>
        <div className="text-xs text-gray-500 space-y-0.5">
          <div className="flex justify-between">
            <span>Salud Batería:</span>
            <span className="font-medium text-gray-900">{battery}</span>
          </div>
          <div className="flex justify-between">
            <span>Estado:</span>
            <span className="font-medium text-gray-900">{grade}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">Precio Estimado</span>
        <span className="font-black text-gray-900">{price}</span>
      </div>
    </div>
  </motion.div>
);
