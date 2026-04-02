import React from 'react';
import { BarChart2, TrendingUp, PieChart, Download, Calendar, DollarSign, Package, Activity } from 'lucide-react';
import { motion, Variants } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

const salesData = [
  { name: 'Ene', ventas: 45000 },
  { name: 'Feb', ventas: 52000 },
  { name: 'Mar', ventas: 48000 },
  { name: 'Abr', ventas: 61000 },
  { name: 'May', ventas: 59000 },
  { name: 'Jun', ventas: 75000 },
  { name: 'Jul', ventas: 82000 },
  { name: 'Ago', ventas: 78000 },
  { name: 'Sep', ventas: 95000 },
  { name: 'Oct', ventas: 110000 },
  { name: 'Nov', ventas: 105000 },
  { name: 'Dic', ventas: 125400 },
];

export const Reports: React.FC = () => {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4">
        <p className="text-sm font-semibold">Módulo en preview:</p>
        <p className="text-sm mt-1">
          Estos gráficos siguen en modo demo. No uses esta pantalla como validación funcional del backend durante el testing inicial.
        </p>
      </motion.div>
      {/* Header Info */}
      <motion.div variants={item} className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Reportes y Analíticas</h1>
          <p className="text-gray-500 text-sm">Métricas clave de rendimiento y exportación de datos.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 sm:flex-none justify-center px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 flex items-center gap-2 transition-colors">
            <Calendar size={16} /> Este Mes
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 sm:flex-none justify-center px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2 transition-colors">
            <Download size={16} /> Exportar Reporte
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item}><StatCard title="INGRESOS TOTALES" value="$1,245,000" trend="+15.2%" icon={<DollarSign size={18} className="text-emerald-500" />} /></motion.div>
        <motion.div variants={item}><StatCard title="UTILIDAD BRUTA" value="$286,350" trend="+8.4%" icon={<TrendingUp size={18} className="text-blue-500" />} /></motion.div>
        <motion.div variants={item}><StatCard title="EQUIPOS VENDIDOS" value="142" trend="-3.1%" trendDown icon={<Package size={18} className="text-gray-400" />} /></motion.div>
        <motion.div variants={item}><StatCard title="TASA DE CONVERSIÓN" value="68%" trend="+5.0%" icon={<Activity size={18} className="text-purple-500" />} /></motion.div>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <motion.div variants={item} className="col-span-1 lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900">Evolución de Ventas</h2>
            <button className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"><BarChart2 size={18} /></button>
          </div>
          <div className="flex-1 h-72 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ventas']}
                />
                <Area 
                  type="monotone" 
                  dataKey="ventas" 
                  stroke="#000000" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorVentas)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Secondary Charts */}
        <div className="space-y-6">
          <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Ventas por Modelo</h2>
              <PieChart size={18} className="text-gray-400" />
            </div>
            <div className="space-y-4">
              <ProgressBar label="iPhone 15 Pro Max" value={45} color="bg-black" />
              <ProgressBar label="iPhone 14 Pro" value={25} color="bg-gray-600" />
              <ProgressBar label="iPhone 13" value={15} color="bg-gray-400" />
              <ProgressBar label="Otros" value={15} color="bg-gray-200" />
            </div>
          </motion.div>

          <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Origen de Ingresos</h2>
            </div>
            <div className="flex items-center justify-center py-4">
              <motion.div 
                initial={{ '--conic-value': '0%' } as any}
                animate={{ '--conic-value': '75%' } as any}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                className="relative w-32 h-32 rounded-full flex items-center justify-center"
                style={{ 
                  background: 'conic-gradient(#000 0% var(--conic-value), #e5e7eb var(--conic-value) 100%)' 
                }}
              >
                <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center">
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                    className="text-2xl font-black text-gray-900"
                  >
                    75%
                  </motion.span>
                </div>
              </motion.div>
            </div>
            <div className="flex justify-between text-xs font-medium text-gray-500 mt-2">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-black"></div> Venta Directa</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-200"></div> Canjes</div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
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
    <div className="text-xs text-gray-400 font-bold tracking-wider mb-1">{title}</div>
    <div className="text-2xl font-black text-gray-900">{value}</div>
  </motion.div>
);

const ProgressBar = ({ label, value, color }: any) => (
  <div>
    <div className="flex justify-between text-xs font-medium mb-1">
      <span className="text-gray-700">{label}</span>
      <span className="text-gray-900 font-bold">{value}%</span>
    </div>
    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={`h-full ${color} rounded-full`} 
      />
    </div>
  </div>
);
