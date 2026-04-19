import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { ArrowRight, Boxes, ClipboardList, MessageCircleMore, ShoppingCart } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
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
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export const Dashboard: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { inventory, sales, tradeIns, clients, appSession } = useAppContext();
  const isStaff = appSession?.membership?.role === 'STAFF';
  const welcomeName = appSession?.user.displayName?.trim() || 'equipo';
  const storeName = appSession?.store?.name?.trim();

  const availableInventory = inventory.filter(product => product.status === 'DISPONIBLE');
  const inventoryValue = availableInventory.reduce((sum, product) => sum + product.price, 0);
  const averageTicket = sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.amount, 0) / sales.length : 0;
  const pendingTradeIns = tradeIns.filter(trade => ['PENDIENTE', 'EN REVISIÓN', 'PERITAJE TÉC.', 'LISTO'].includes(trade.status)).length;

  const inventoryByCondition = useMemo(() => {
    const groups = [
      { label: 'NUEVO', items: availableInventory.filter(product => product.condition === 'NUEVO') },
      { label: 'USADO', items: availableInventory.filter(product => product.condition === 'USADO') },
      { label: 'PRE-OWNED', items: availableInventory.filter(product => product.condition === 'PRE-OWNED') },
    ];

    return groups.map(group => ({
      ...group,
      count: group.items.length,
      value: group.items.reduce((sum, product) => sum + product.price, 0),
      percent: availableInventory.length > 0 ? Math.round((group.items.length / availableInventory.length) * 100) : 0,
    }));
  }, [availableInventory]);

  const recentSales = sales.slice(0, 3).map(sale => ({
    ...sale,
    client: clients.find(client => client.id === sale.clientId),
    product: inventory.find(product => product.id === sale.productId),
  }));

  const highlightedTradeIns = tradeIns.slice(0, 2).map(trade => ({
    ...trade,
    client: clients.find(client => client.id === trade.clientId),
  }));

  if (isStaff) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.section
            variants={item}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white lg:col-span-2"
          >
            <div className="border-b border-gray-100 bg-gray-50/70 px-6 py-4">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Dashboard
              </span>
            </div>
            <div className="flex min-h-[300px] flex-col justify-between gap-8 px-6 py-8 md:px-10 md:py-10">
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-500">
                  {storeName ? `Sesión activa en ${storeName}` : 'Sesión activa'}
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-5xl">
                  Bienvenido, {welcomeName}
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-gray-500 md:text-base">
                  Este espacio está simplificado para tu rol. Tenés accesos rápidos y recordatorios
                  para empezar a trabajar sin distraerte con métricas o reportes.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => onNavigate?.('inventory')}
                  className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                >
                  Ir a inventario
                </button>
                <button
                  onClick={() => onNavigate?.('sales')}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Ver ventas
                </button>
                <button
                  onClick={() => onNavigate?.('tradeins')}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Abrir canjes
                </button>
              </div>
            </div>
          </motion.section>

          <motion.section variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-gray-100 p-3 text-gray-900">
                <ClipboardList size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Tu foco hoy</h2>
                <p className="text-sm text-gray-500">Atajos para las tareas más comunes</p>
              </div>
            </div>
            <div className="space-y-3">
              <QuickActionCard
                icon={<Boxes size={16} />}
                title="Revisar inventario"
                description="Buscá equipos, verificá estado y actualizá movimientos del stock."
                onClick={() => onNavigate?.('inventory')}
              />
              <QuickActionCard
                icon={<ShoppingCart size={16} />}
                title="Registrar ventas"
                description="Cargá una venta nueva o repasá las operaciones recientes."
                onClick={() => onNavigate?.('sales')}
              />
            </div>
          </motion.section>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.section variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-gray-100 p-3 text-gray-900">
                <Boxes size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Flujo sugerido</h2>
                <p className="text-sm text-gray-500">Una guía rápida para arrancar el turno</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                1. Revisá ingresos o cambios en inventario.
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                2. Registrá ventas y canjes a medida que ocurren.
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                3. Si algo no cierra, avisá al responsable o dejá feedback.
              </div>
            </div>
          </motion.section>

          <motion.section variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <ShoppingCart size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Acciones rápidas</h2>
                <p className="text-sm text-gray-500">Entrá directo a los módulos operativos</p>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => onNavigate?.('sales')}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Nueva revisión de ventas
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => onNavigate?.('tradeins')}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Seguimiento de canjes
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => onNavigate?.('inventory')}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Stock y movimientos
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.section>

          <motion.section variants={item} className="rounded-2xl bg-black p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-white/10 p-3 text-white">
                <MessageCircleMore size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">¿Qué le agregarías?</h2>
                <p className="text-sm text-gray-400">Mandanos feedback directo por WhatsApp</p>
              </div>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-gray-400">
              Si encontrás algo raro, te falta una herramienta o tenés una idea para mejorar el flujo,
              escribinos directo y lo revisamos.
            </p>
            <a
              href="https://wa.me/5491141722188"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Mandar mensaje
            </a>
          </motion.section>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <motion.div variants={item}>
          <StatCard
            title="STOCK DISPONIBLE"
            value={formatCompactNumber(availableInventory.length)}
            trend={formatCurrency(inventoryValue)}
            subtitle="Equipos hoy en inventario"
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            title="VENTAS REGISTRADAS"
            value={formatCompactNumber(sales.length)}
            trend={formatCurrency(sales.reduce((sum, sale) => sum + sale.amount, 0))}
            subtitle="Histórico cargado"
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            title="MARGEN ESTIMADO"
            value={`${sales.length > 0 ? Math.round((sales.reduce((sum, sale) => sum + sale.amount, 0) - sales.reduce((sum, sale) => sum + (inventory.find(product => product.id === sale.productId)?.cost || 0), 0)) / sales.reduce((sum, sale) => sum + sale.amount, 0) * 100) : 0}%`}
            trend="Sobre ventas actuales"
            subtitle="Estimación bruta"
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            title="TICKET PROMEDIO"
            value={formatCurrency(averageTicket)}
            trend={`${sales.length} ventas`}
            subtitle="Promedio por operación"
          />
        </motion.div>
        <motion.div variants={item} className="sm:col-span-2 lg:col-span-1">
          <StatCard
            title="CANJES PENDIENTES"
            value={String(pendingTradeIns)}
            trend={`${tradeIns.length} cargados`}
            subtitle="Equipos en seguimiento"
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-1 space-y-6 lg:col-span-2">
          <motion.div variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Estado del Inventario por Condición</h2>
              <button
                onClick={() => onNavigate?.('inventory')}
                className="text-sm font-semibold text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900"
              >
                Ver detalle
              </button>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {inventoryByCondition.map(group => (
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

          <motion.div variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-6 flex justify-between items-center">
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
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="pb-4 font-semibold">ID Operación</th>
                    <th className="pb-4 font-semibold">Cliente</th>
                    <th className="pb-4 font-semibold">Modelo / IMEI</th>
                    <th className="pb-4 font-semibold">Monto</th>
                    <th className="pb-4 font-semibold">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentSales.length > 0 ? recentSales.map(sale => (
                    <tr key={sale.id} className="cursor-pointer transition-colors hover:bg-gray-50" onClick={() => onNavigate?.('sales')}>
                      <td className="py-4 font-medium text-gray-400">#{sale.id}</td>
                      <td className="py-4 font-bold text-gray-900">{sale.client?.name || 'Cliente eliminado'}</td>
                      <td className="py-4">
                        <div className="font-medium text-gray-900">
                          {sale.product ? `${sale.product.model} ${sale.product.capacity}` : 'Producto eliminado'}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">IMEI: {sale.product?.imei || 'No disponible'}</div>
                      </td>
                      <td className="py-4 font-bold text-gray-900">{formatCurrency(sale.amount)}</td>
                      <td className="py-4">
                        <span className="rounded-md bg-gray-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-600">
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
          <motion.div variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Evaluaciones de Canje</h2>
            <div className="space-y-4">
              {highlightedTradeIns.length > 0 ? highlightedTradeIns.map(trade => (
                <div key={trade.id} className="rounded-xl border border-gray-100 p-4 transition-colors hover:border-gray-300">
                  <div className="mb-2 flex justify-between items-start">
                    <div>
                      <div className="mb-1 text-xs font-medium text-gray-400">ID: #{trade.id}</div>
                      <h3 className="font-bold text-gray-900">{trade.deviceReceived}</h3>
                    </div>
                    <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${
                      trade.status === 'APROBADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {trade.status}
                    </span>
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-sm text-gray-500">Cliente: {trade.client?.name || 'Cliente eliminado'}</span>
                    <button
                      onClick={() => onNavigate?.('tradeins')}
                      className="flex items-center gap-1 text-sm font-bold text-gray-900 hover:underline"
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
              className="mt-4 w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Ver todos los canjes ({tradeIns.length})
            </button>
          </motion.div>

          <motion.div variants={item} className="rounded-2xl bg-black p-6">
            <h2 className="mb-2 text-base font-bold text-white">¿Qué le agregarías?</h2>
            <p className="mb-5 text-sm leading-relaxed text-gray-400">
              iManager está en beta activa. Si tenés una idea, algo que te falta o algo que no te cierra, escribinos directo.
            </p>
            <a
              href="https://wa.me/5491141722188"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-black transition-colors hover:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" xmlns="http://www.w3.org/2000/svg">
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

const QuickActionCard = ({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex w-full items-start gap-3 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
  >
    <div className="rounded-lg bg-gray-100 p-2 text-gray-900">
      {icon}
    </div>
    <div className="space-y-1">
      <div className="text-sm font-bold text-gray-900">{title}</div>
      <p className="text-sm leading-relaxed text-gray-500">{description}</p>
    </div>
  </button>
);

const StatCard = ({
  title,
  value,
  trend,
  trendDown = false,
  subtitle,
}: {
  title: string;
  value: string;
  trend: string;
  trendDown?: boolean;
  subtitle: string;
}) => (
  <motion.div
    whileHover={{ y: -4, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
    className="flex h-full cursor-default flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 transition-shadow"
  >
    <h3 className="mb-2 text-xs font-bold tracking-wider text-gray-500">{title}</h3>
    <div className="mb-1 flex items-end gap-2">
      <span className="text-2xl font-black leading-none text-gray-900">{value}</span>
      <span className={`mb-0.5 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-bold ${trendDown ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {trend}
      </span>
    </div>
    <p className="text-xs font-medium text-gray-400">{subtitle}</p>
  </motion.div>
);

const InventoryStat = ({
  label,
  count,
  value,
  percent,
}: {
  label: string;
  count: string;
  value: string;
  percent: number;
}) => (
  <div>
    <div className="mb-2 flex items-center gap-2">
      <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-black">
        <div className="h-1.5 w-1.5 rounded-full bg-black"></div>
      </div>
      <span className="text-sm font-bold text-gray-900">{label}</span>
    </div>
    <div className="mb-1 flex items-baseline gap-1">
      <span className="text-3xl font-black text-gray-900">{count}</span>
      <span className="text-sm font-medium text-gray-400">u.</span>
    </div>
    <div className="mb-3 text-sm text-gray-500">{value}</div>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        className="h-full rounded-full bg-black"
      />
    </div>
  </div>
);
