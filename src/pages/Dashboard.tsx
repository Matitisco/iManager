import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { ArrowRight } from 'lucide-react';
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

          <motion.div variants={item} className="bg-black p-6 rounded-2xl">
            <h2 className="text-base font-bold text-white mb-2">¿Qué le agregarías?</h2>
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
              iManager está en beta activa. Si tenés una idea, algo que te falta o algo que no te cierra, escribinos directo.
            </p>
            <a
              href="https://wa.me/5491141722188"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-white text-black text-sm font-bold rounded-xl hover:bg-gray-100 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Mandar mensaje
            </a>
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
