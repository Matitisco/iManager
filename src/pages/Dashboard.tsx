import React from 'react';
import { useAppContext } from '../context/AppContext';
import { AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCompactNumber } from '../lib/utils';

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

export const Dashboard: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { inventory, sales, tradeIns } = useAppContext();

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div variants={item}><StatCard title="STOCK DISPONIBLE" value={formatCompactNumber(1248)} trend="+2.4%" subtitle="Unidades totales en piso" /></motion.div>
        <motion.div variants={item}><StatCard title="VENTAS HOY" value={formatCompactNumber(450200, true)} trend="+10.2%" subtitle="Corte parcial actual" /></motion.div>
        <motion.div variants={item}><StatCard title="MARGEN PROMEDIO" value="18.5%" trend="-0.5%" trendDown subtitle="Utilidad bruta promedio" /></motion.div>
        <motion.div variants={item}><StatCard title="TICKET PROMEDIO" value={formatCompactNumber(12400, true)} trend="+1.8%" subtitle="Por transacción cerrada" /></motion.div>
        <motion.div variants={item} className="sm:col-span-2 lg:col-span-1"><StatCard title="CANJES PENDIENTES" value="12" trend="+3" subtitle="Equipos en evaluación" /></motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          {/* Inventory Status */}
          <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Estado del Inventario por Condición</h2>
              <button 
                onClick={() => onNavigate && onNavigate('inventory')}
                className="text-sm font-semibold text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900"
              >
                Ver detalle
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <InventoryStat label="NUEVO" count="840" value="$2.4M Valuación" percent={70} />
              <InventoryStat label="USADO" count="312" value="$840k Valuación" percent={25} />
              <InventoryStat label="PRE-OWNED" count="96" value="$420k Valuación" percent={10} />
            </div>
          </motion.div>

          {/* Recent Sales */}
          <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Ventas Recientes</h2>
              <button className="text-sm font-semibold text-gray-500 hover:text-gray-900">Descargar CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="pb-4 font-semibold">ID Operación</th>
                    <th className="pb-4 font-semibold">Cliente</th>
                    <th className="pb-4 font-semibold">Modelo / IMEI</th>
                    <th className="pb-4 font-semibold">Monto</th>
                    <th className="pb-4 font-semibold">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.slice(0, 3).map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 text-gray-400 font-medium">#{sale.id}</td>
                      <td className="py-4 font-bold text-gray-900">
                        {sale.clientId === '1' ? 'Carlos Méndez' : sale.clientId === '2' ? 'Lucía Fernández' : 'Jorge Ruiz'}
                      </td>
                      <td className="py-4">
                        <div className="font-medium text-gray-900">
                          {sale.productId === '1' ? 'iPhone 15 Pro Max' : sale.productId === '2' ? 'Samsung S24 Ultra' : 'MacBook Air M2'}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">IMEI: 3542...9902</div>
                      </td>
                      <td className="py-4 font-bold text-gray-900">${sale.amount.toLocaleString()}</td>
                      <td className="py-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-md uppercase tracking-wide">
                          {sale.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Critical Alerts */}
          <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-gray-200">
            <h2 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-4">
              <AlertTriangle size={20} />
              Alertas Críticas
            </h2>
            <div className="space-y-3">
              <motion.div whileHover={{ scale: 1.02 }} className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3 cursor-pointer">
                <AlertCircle className="text-red-500 shrink-0" size={20} />
                <div>
                  <h3 className="font-bold text-red-900 text-sm">IMEI Duplicado Detectado</h3>
                  <p className="text-red-700 text-xs mt-0.5">Conflicto en ingreso: 3542...8810</p>
                </div>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 cursor-pointer">
                <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                <div>
                  <h3 className="font-bold text-amber-900 text-sm">Stock Crítico</h3>
                  <p className="text-amber-700 text-xs mt-0.5">iPhone 13 (Used) - Solo 2 unidades</p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Trade-in Evaluations */}
          <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Evaluaciones de Canje</h2>
            <div className="space-y-4">
              <div className="border border-gray-100 p-4 rounded-xl hover:border-gray-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-xs text-gray-400 font-medium mb-1">ID: #CAN-2204</div>
                    <h3 className="font-bold text-gray-900">iPhone 12 Pro 128GB</h3>
                  </div>
                  <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase">Pendiente</span>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-sm text-gray-500">Cliente: Roberto Díaz</span>
                  <button 
                    onClick={() => onNavigate?.('tradeins')}
                    className="text-sm font-bold text-gray-900 flex items-center gap-1 hover:underline"
                  >
                    Revisar <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              <div className="border border-gray-100 p-4 rounded-xl hover:border-gray-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-xs text-gray-400 font-medium mb-1">ID: #CAN-2201</div>
                    <h3 className="font-bold text-gray-900">Galaxy Z Flip 5</h3>
                  </div>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded uppercase">Aprobado</span>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-sm text-gray-500">Cliente: Ana Sofía V.</span>
                  <button 
                    onClick={() => onNavigate?.('tradeins')}
                    className="text-sm font-bold text-gray-900 flex items-center gap-1 hover:underline"
                  >
                    Detalles <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
            <button 
              onClick={() => onNavigate?.('tradeins')}
              className="w-full mt-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Ver todos los canjes (12)
            </button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

const StatCard = ({ title, value, trend, trendDown = false, subtitle }: any) => (
  <motion.div 
    whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
    className="bg-white p-5 rounded-2xl border border-gray-200 flex flex-col justify-between h-full transition-shadow cursor-default"
  >
    <h3 className="text-xs font-bold text-gray-500 tracking-wider mb-2">{title}</h3>
    <div className="flex items-end gap-2 mb-1">
      <span className="text-2xl font-black text-gray-900 leading-none">{value}</span>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap mb-0.5 ${trendDown ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {trend}
      </span>
    </div>
    <p className="text-xs text-gray-400 font-medium">{subtitle}</p>
  </motion.div>
);

const InventoryStat = ({ label, count, value, percent }: any) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      <div className="w-4 h-4 rounded-full border-2 border-black flex items-center justify-center">
        <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
      </div>
      <span className="font-bold text-sm text-gray-900">{label}</span>
    </div>
    <div className="flex items-baseline gap-1 mb-1">
      <span className="text-3xl font-black text-gray-900">{count}</span>
      <span className="text-sm font-medium text-gray-400">u.</span>
    </div>
    <div className="text-sm text-gray-500 mb-3">{value}</div>
    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        className="h-full bg-black rounded-full" 
      />
    </div>
  </div>
);

