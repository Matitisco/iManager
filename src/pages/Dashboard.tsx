import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion, Variants } from 'motion/react';
import { formatCompactNumber, formatCurrency } from '../lib/utils';

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

export const Dashboard: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { inventory, sales, tradeIns, clients } = useAppContext();

  const availableInventory = inventory.filter(product => product.status === 'DISPONIBLE');
  const inventoryValue = availableInventory.reduce((sum, product) => sum + product.price, 0);
  const averageTicket = sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.amount, 0) / sales.length : 0;
  const pendingTradeIns = tradeIns.filter(trade => ['PENDIENTE', 'EN REVISIÓN', 'PERITAJE TÉC.', 'LISTO'].includes(trade.status)).length;

  const inventoryByCondition = useMemo(() => {
    const groups = [
      { label: 'NUEVO', items: availableInventory.filter(item => item.condition === 'NUEVO') },
      { label: 'USADO', items: availableInventory.filter(item => item.condition === 'USADO') },
      { label: 'PRE-OWNED', items: availableInventory.filter(item => item.condition === 'PRE-OWNED') },
    ];

    return groups.map(group => ({
      ...group,
      count: group.items.length,
      value: group.items.reduce((sum, item) => sum + item.price, 0),
      percent: availableInventory.length > 0 ? Math.round((group.items.length / availableInventory.length) * 100) : 0,
    }));
  }, [availableInventory]);

  const recentSales = sales.slice(0, 3).map((sale) => ({
    ...sale,
    client: clients.find(client => client.id === sale.clientId),
    product: inventory.find(product => product.id === sale.productId),
  }));

  const duplicateImeis = inventory
    .filter(item => item.imei)
    .reduce<Record<string, number>>((acc, item) => {
      acc[item.imei] = (acc[item.imei] || 0) + 1;
      return acc;
    }, {});

  const duplicatedImei = Object.entries(duplicateImeis).find(([, count]) => count > 1)?.[0];

  const stockByModel = availableInventory.reduce<Record<string, number>>((acc, item) => {
    acc[item.model] = (acc[item.model] || 0) + 1;
    return acc;
  }, {});

  const lowStockModel = Object.entries(stockByModel)
    .filter(([, count]) => count <= 2)
    .sort((a, b) => a[1] - b[1])[0];

  const highlightedTradeIns = tradeIns.slice(0, 2).map((trade) => ({
    ...trade,
    client: clients.find(client => client.id === trade.clientId),
  }));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div variants={item}><StatCard title="STOCK DISPONIBLE" value={formatCompactNumber(availableInventory.length)} trend={formatCurrency(inventoryValue)} subtitle="Equipos hoy en inventario" /></motion.div>
        <motion.div variants={item}><StatCard title="VENTAS REGISTRADAS" value={formatCompactNumber(sales.length)} trend={formatCurrency(sales.reduce((sum, sale) => sum + sale.amount, 0))} subtitle="Histórico cargado" /></motion.div>
        <motion.div variants={item}><StatCard title="MARGEN ESTIMADO" value={`${sales.length > 0 ? Math.round((sales.reduce((sum, sale) => sum + sale.amount, 0) - sales.reduce((sum, sale) => sum + (inventory.find(product => product.id === sale.productId)?.cost || 0), 0)) / sales.reduce((sum, sale) => sum + sale.amount, 0) * 100) : 0}%`} trend="Sobre ventas actuales" subtitle="Estimación bruta" /></motion.div>
        <motion.div variants={item}><StatCard title="TICKET PROMEDIO" value={formatCurrency(averageTicket)} trend={`${sales.length} ventas`} subtitle="Promedio por operación" /></motion.div>
        <motion.div variants={item} className="sm:col-span-2 lg:col-span-1"><StatCard title="CANJES PENDIENTES" value={String(pendingTradeIns)} trend={`${tradeIns.length} cargados`} subtitle="Equipos en seguimiento" /></motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 space-y-6">
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
              {inventoryByCondition.map((group) => (
                <InventoryStat
                  key={group.label}
                  label={group.label}
                  count={String(group.count)}
                  value={formatCurrency(group.value)}
                  percent={group.percent}
                />
              ))}
            </div>
          </motion.div>

          <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Ventas Recientes</h2>
              <button
                onClick={() => onNavigate?.('sales')}
                className="text-sm font-semibold text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900"
              >
                Ver todas
              </button>
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
                  {recentSales.length > 0 ? recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 text-gray-400 font-medium">#{sale.id}</td>
                      <td className="py-4 font-bold text-gray-900">{sale.client?.name || 'Cliente eliminado'}</td>
                      <td className="py-4">
                        <div className="font-medium text-gray-900">
                          {sale.product ? `${sale.product.model} ${sale.product.capacity}` : 'Producto eliminado'}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">IMEI: {sale.product?.imei || 'No disponible'}</div>
                      </td>
                      <td className="py-4 font-bold text-gray-900">{formatCurrency(sale.amount)}</td>
                      <td className="py-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-md uppercase tracking-wide">
                          {sale.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        Todavía no hay ventas para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-gray-200">
            <h2 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-4">
              <AlertTriangle size={20} />
              Alertas Críticas
            </h2>
            <div className="space-y-3">
              {duplicatedImei ? (
                <motion.div whileHover={{ scale: 1.02 }} className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3 cursor-default">
                  <AlertCircle className="text-red-500 shrink-0" size={20} />
                  <div>
                    <h3 className="font-bold text-red-900 text-sm">IMEI duplicado detectado</h3>
                    <p className="text-red-700 text-xs mt-0.5">{duplicatedImei}</p>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-sm text-emerald-800 font-medium">
                  No se detectaron IMEIs duplicados en el inventario actual.
                </div>
              )}

              {lowStockModel ? (
                <motion.div whileHover={{ scale: 1.02 }} className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 cursor-default">
                  <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                  <div>
                    <h3 className="font-bold text-amber-900 text-sm">Stock crítico</h3>
                    <p className="text-amber-700 text-xs mt-0.5">{lowStockModel[0]} - Solo {lowStockModel[1]} unidades</p>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-sm text-gray-600 font-medium">
                  No hay modelos con stock crítico por ahora.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Evaluaciones de Canje</h2>
            <div className="space-y-4">
              {highlightedTradeIns.length > 0 ? highlightedTradeIns.map((trade) => (
                <div key={trade.id} className="border border-gray-100 p-4 rounded-xl hover:border-gray-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-xs text-gray-400 font-medium mb-1">ID: #{trade.id}</div>
                      <h3 className="font-bold text-gray-900">{trade.deviceReceived}</h3>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                      trade.status === 'APROBADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {trade.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-gray-500">Cliente: {trade.client?.name || 'Cliente eliminado'}</span>
                    <button 
                      onClick={() => onNavigate?.('tradeins')}
                      className="text-sm font-bold text-gray-900 flex items-center gap-1 hover:underline"
                    >
                      Revisar <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-gray-500">Todavía no hay canjes registrados.</div>
              )}
            </div>
            <button 
              onClick={() => onNavigate?.('tradeins')}
              className="w-full mt-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Ver todos los canjes ({tradeIns.length})
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
