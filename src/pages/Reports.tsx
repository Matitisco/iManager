import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart2,
  Calendar,
  Download,
  DollarSign,
  Package,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAppContext } from '../context/AppContext';
import { fetchReportsOverview } from '../services/reports-api';
import type { ReportsOverview, ReportsRangeKey } from '../types/reports';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } },
};

const rangeOptions: Array<{ key: ReportsRangeKey; label: string }> = [
  { key: 'this_month', label: 'Este mes' },
  { key: 'last_90_days', label: '90 días' },
  { key: 'this_year', label: 'Este año' },
  { key: 'all_time', label: 'Histórico' },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return 'Todo el historial';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function getRangeWindow(rangeKey: ReportsRangeKey) {
  if (rangeKey === 'all_time') {
    return { startDate: null, endDate: null };
  }

  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  if (rangeKey === 'this_month') {
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  }

  if (rangeKey === 'this_year') {
    const startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  }

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 89);
  startDate.setHours(0, 0, 0, 0);

  return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
}

function buildCsvContent(report: ReportsOverview) {
  const sections: string[][] = [
    ['Sección', 'Métrica', 'Valor'],
    ['Resumen', 'Ingresos', report.summary.revenue.toFixed(2)],
    ['Resumen', 'Margen estimado', report.summary.grossProfit.toFixed(2)],
    ['Resumen', 'Equipos vendidos', String(report.summary.unitsSold)],
    ['Resumen', 'Ticket promedio', report.summary.averageTicket.toFixed(2)],
    ['Resumen', 'Ventas pendientes', String(report.summary.pendingSales)],
    ['Resumen', 'Canjes aprobados', String(report.summary.approvedTradeIns)],
    ['Inventario', 'Stock total', String(report.inventory.totalItems)],
    ['Inventario', 'Disponibles', String(report.inventory.availableItems)],
    ['Inventario', 'Vendidos', String(report.inventory.soldItems)],
    ['Inventario', 'En revisión', String(report.inventory.inReviewItems)],
    ['Clientes', 'Total clientes', String(report.clients.totalClients)],
    ['Clientes', 'Clientes activos', String(report.clients.activeClients)],
    ['Clientes', 'Saldo pendiente', report.clients.pendingBalance.toFixed(2)],
    ['Canjes', 'Total en rango', String(report.tradeIns.totalInRange)],
    ['Canjes', 'Aprobados', String(report.tradeIns.approvedInRange)],
    ['Canjes', 'Caja generada', report.tradeIns.cashGenerated.toFixed(2)],
    ['Rango', 'Inicio', report.filters.startDate ?? 'Todo'],
    ['Rango', 'Fin', report.filters.endDate ?? 'Todo'],
    [''],
    ['Serie', 'Período', 'Ingresos', 'Unidades'],
    ...report.salesSeries.map((point) => [
      'Serie',
      point.label,
      point.revenue.toFixed(2),
      String(point.unitsSold),
    ]),
    [''],
    ['Modelos', 'Modelo', 'Unidades', 'Ingresos', 'Share'],
    ...report.topModels.map((model) => [
      'Modelos',
      model.model,
      String(model.unitsSold),
      model.revenue.toFixed(2),
      model.share.toFixed(2),
    ]),
    [''],
    ['Métodos', 'Método', 'Operaciones', 'Ingresos', 'Share'],
    ...report.paymentMethods.map((method) => [
      'Métodos',
      method.label,
      String(method.count),
      method.revenue.toFixed(2),
      method.share.toFixed(2),
    ]),
  ];

  return sections
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
        .join(',')
    )
    .join('\n');
}

function downloadCsv(report: ReportsOverview) {
  const csv = buildCsvContent(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reportes-${report.filters.rangeKey}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

function getRevenueSourceShare(report: ReportsOverview) {
  const tradeSource = report.paymentMethods.find((method) => method.label === 'CANJE / PAGO')?.revenue ?? 0;
  const directSource = Math.max(report.summary.revenue - tradeSource, 0);
  const total = directSource + tradeSource;

  return {
    directSource,
    tradeSource,
    directShare: total > 0 ? (directSource / total) * 100 : 0,
  };
}

export const Reports: React.FC = () => {
  const { user, backendStatus, backendMessage, appSession } = useAppContext();
  const [selectedRange, setSelectedRange] = useState<ReportsRangeKey>('this_month');
  const [report, setReport] = useState<ReportsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backendReady =
    backendStatus === 'ready' &&
    !!appSession?.store &&
    !appSession.onboardingRequired;

  useEffect(() => {
    if (!user || !backendReady) {
      setReport(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const windowRange = getRangeWindow(selectedRange);
        const nextReport = await fetchReportsOverview(user, {
          rangeKey: selectedRange,
          startDate: windowRange.startDate,
          endDate: windowRange.endDate,
        });

        if (!cancelled) {
          setReport(nextReport);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los reportes');
          setReport(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [backendReady, selectedRange, user]);

  const revenueShare = report ? getRevenueSourceShare(report) : { directSource: 0, tradeSource: 0, directShare: 0 };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {!backendReady && (
        <motion.div
          variants={item}
          className={`rounded-2xl border p-4 ${
            backendStatus === 'offline'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p className="text-sm font-semibold">Reportes requiere backend activo</p>
          <p className="mt-1 text-sm">
            {backendMessage || 'Esperando contexto de tienda y conexión backend para calcular métricas reales.'}
          </p>
        </motion.div>
      )}

      <motion.div variants={item} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
            <BarChart2 size={14} />
            PostgreSQL en vivo
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reportes y analíticas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Resumen operativo de {appSession?.store?.name || 'tu tienda'} para el rango visible.
          </p>
          {report && (
            <p className="mt-2 text-xs text-gray-400">
              {formatDateLabel(report.filters.startDate)}{' '}
              {report.filters.endDate ? `→ ${formatDateLabel(report.filters.endDate)}` : ''}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <motion.button
                key={option.key}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedRange(option.key)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  selectedRange === option.key
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Calendar size={16} />
                  {option.label}
                </span>
              </motion.button>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => report && downloadCsv(report)}
            disabled={!report || isLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Download size={16} />
            Exportar resumen
          </motion.button>
        </div>
      </motion.div>

      {isLoading && (
        <motion.div variants={item} className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
            <p className="text-sm font-medium">Calculando métricas reales...</p>
          </div>
        </motion.div>
      )}

      {!isLoading && error && (
        <motion.div variants={item} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="text-sm font-semibold">No pudimos cargar reportes</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        </motion.div>
      )}

      {!isLoading && !error && report && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <motion.div variants={item}>
              <StatCard
                title="Ingresos del rango"
                value={formatCurrency(report.summary.revenue)}
                description={`${report.summary.unitsSold} ventas completadas`}
                icon={<DollarSign size={18} className="text-emerald-600" />}
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Margen estimado"
                value={formatCurrency(report.summary.grossProfit)}
                description="Monto vendido menos costo del equipo asociado"
                icon={<TrendingUp size={18} className="text-black" />}
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Ticket promedio"
                value={formatCurrency(report.summary.averageTicket)}
                description={`${report.summary.pendingSales} ventas pendientes en el rango`}
                icon={<Wallet size={18} className="text-gray-700" />}
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Canjes aprobados"
                value={String(report.summary.approvedTradeIns)}
                description={formatCurrency(report.tradeIns.cashGenerated)}
                icon={<RefreshCw size={18} className="text-amber-600" />}
              />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <motion.div variants={item} className="xl:col-span-2 rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Evolución de ventas</h2>
                  <p className="text-sm text-gray-500">Ingresos y unidades concretadas en el rango visible.</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {report.salesSeries.length} períodos
                </div>
              </div>

              {report.salesSeries.length === 0 ? (
                <EmptyPanel message="Todavía no hay ventas completadas para este rango." />
              ) : (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.salesSeries} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportsRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#111827" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#111827" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#9ca3af' }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#9ca3af' }}
                        tickFormatter={(value: number) => formatCompactCurrency(value)}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)',
                        }}
                        formatter={(value: number, name: string) => [
                          name === 'unitsSold' ? `${value} equipos` : formatCurrency(value),
                          name === 'unitsSold' ? 'Unidades' : 'Ingresos',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#111827"
                        strokeWidth={3}
                        fill="url(#reportsRevenueGradient)"
                        fillOpacity={1}
                        animationDuration={900}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>

            <div className="space-y-6">
              <motion.div variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Modelos más vendidos</h2>
                    <p className="text-sm text-gray-500">Top del rango visible.</p>
                  </div>
                  <Package size={18} className="text-gray-400" />
                </div>
                {report.topModels.length === 0 ? (
                  <EmptyPanel message="No hay modelos vendidos todavía en este rango." compact />
                ) : (
                  <div className="space-y-4">
                    {report.topModels.map((model) => (
                      <ProgressBar
                        key={model.model}
                        label={model.model}
                        value={model.share}
                        meta={`${model.unitsSold} equipos · ${formatCurrency(model.revenue)}`}
                      />
                    ))}
                  </div>
                )}
              </motion.div>

              <motion.div variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Origen de ingresos</h2>
                  <p className="text-sm text-gray-500">Venta directa vs ventas con canje/pago.</p>
                </div>
                <div className="flex items-center justify-center py-4">
                  <div
                    className="relative flex h-32 w-32 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(#111827 0% ${revenueShare.directShare}%, #d1d5db ${revenueShare.directShare}% 100%)`,
                    }}
                  >
                    <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white">
                      <span className="text-2xl font-black text-gray-900">
                        {Math.round(revenueShare.directShare)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-between text-xs font-medium text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-black" />
                    Venta directa
                  </div>
                  <div>{formatCurrency(revenueShare.directSource)}</div>
                </div>
                <div className="mt-2 flex justify-between text-xs font-medium text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-gray-300" />
                    Canje / pago
                  </div>
                  <div>{formatCurrency(revenueShare.tradeSource)}</div>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <motion.div variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Métodos de pago</h2>
                  <p className="text-sm text-gray-500">Distribución por ingresos.</p>
                </div>
                <Activity size={18} className="text-gray-400" />
              </div>
              {report.paymentMethods.length === 0 ? (
                <EmptyPanel message="Todavía no hay pagos registrados para este rango." compact />
              ) : (
                <div className="space-y-3">
                  {report.paymentMethods.map((method) => (
                    <div key={method.label} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{method.label}</p>
                          <p className="text-xs text-gray-500">{method.count} operaciones</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(method.revenue)}</p>
                          <p className="text-xs text-gray-500">{method.share.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Inventario actual</h2>
                  <p className="text-sm text-gray-500">Snapshot del stock del store.</p>
                </div>
                <Package size={18} className="text-gray-400" />
              </div>
              <div className="space-y-3">
                <MetricRow label="Stock total" value={String(report.inventory.totalItems)} />
                <MetricRow label="Disponibles" value={String(report.inventory.availableItems)} />
                <MetricRow label="Vendidos" value={String(report.inventory.soldItems)} />
                <MetricRow label="En revisión" value={String(report.inventory.inReviewItems)} />
              </div>
            </motion.div>

            <motion.div variants={item} className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Snapshot operativo</h2>
                  <p className="text-sm text-gray-500">Clientes y canjes del período.</p>
                </div>
                <RefreshCw size={18} className="text-gray-400" />
              </div>
              <div className="space-y-3">
                <MetricRow label="Clientes activos" value={String(report.clients.activeClients)} />
                <MetricRow label="Clientes totales" value={String(report.clients.totalClients)} />
                <MetricRow label="Saldo pendiente" value={formatCurrency(report.clients.pendingBalance)} />
                <MetricRow label="Canjes en rango" value={String(report.tradeIns.totalInRange)} />
                <MetricRow label="Canjes aprobados" value={String(report.tradeIns.approvedInRange)} />
                <MetricRow label="Caja por canjes" value={formatCurrency(report.tradeIns.cashGenerated)} />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </motion.div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description, icon }) => (
  <motion.div
    whileHover={{ y: -3 }}
    className="h-full rounded-2xl border border-gray-200 bg-white p-5 transition-shadow"
  >
    <div className="mb-4 flex items-center justify-between">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
        {icon}
      </div>
    </div>
    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</div>
    <div className="text-2xl font-black text-gray-900">{value}</div>
    <p className="mt-2 text-sm text-gray-500">{description}</p>
  </motion.div>
);

interface ProgressBarProps {
  label: string;
  value: number;
  meta: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, value, meta }) => (
  <div>
    <div className="mb-1 flex items-center justify-between gap-3 text-xs font-medium">
      <div className="min-w-0">
        <p className="truncate text-gray-700">{label}</p>
        <p className="truncate text-gray-400">{meta}</p>
      </div>
      <span className="font-bold text-gray-900">{value.toFixed(1)}%</span>
    </div>
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="h-full rounded-full bg-black"
      />
    </div>
  </div>
);

interface MetricRowProps {
  label: string;
  value: string;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value }) => (
  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-3">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="text-sm font-bold text-gray-900">{value}</span>
  </div>
);

const EmptyPanel: React.FC<{ message: string; compact?: boolean }> = ({ message, compact = false }) => (
  <div className={`flex items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-4 text-center text-sm text-gray-500 ${compact ? 'min-h-[120px]' : 'min-h-[240px]'}`}>
    {message}
  </div>
);
