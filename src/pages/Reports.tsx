import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Download,
  DollarSign,
  Package,
  RefreshCw,
  Settings2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Modal } from '../components/Modal';
import { useAppContext } from '../context/AppContext';
import { fetchReportsOverview } from '../services/reports-api';
import type {
  ReportsOverview,
  ReportsRangeKey,
  ReportsWidgetId,
  ReportsWidgetPreferences,
} from '../types/reports';
import {
  buildReportsCsv,
  createDefaultCustomRange,
  DEFAULT_VISIBLE_REPORTS_WIDGET_IDS,
  getCustomRangeError,
  getDefaultReportsWidgetPreferences,
  getRangeWindow,
  parseDateInputBoundary,
  PRESET_REPORTS_RANGE_KEYS,
  readStoredReportsWidgetPreferences,
  REPORTS_WIDGET_IDS,
  writeStoredReportsWidgetPreferences,
} from '../utils/reports';

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

const rangeOptionLabels: Record<Exclude<ReportsRangeKey, 'custom'>, string> = {
  this_month: 'Este mes',
  last_90_days: '90 días',
  this_year: 'Este año',
  all_time: 'Histórico',
};

const widgetCatalog: Array<{
  id: ReportsWidgetId;
  title: string;
  description: string;
}> = [
  {
    id: 'sales-summary',
    title: 'Resumen de ventas',
    description: 'KPIs principales del periodo visible.',
  },
  {
    id: 'sales-by-period',
    title: 'Ventas por periodo',
    description: 'Grafico y tabla compacta del rango aplicado.',
  },
  {
    id: 'inventory-value',
    title: 'Valor de inventario',
    description: 'Costo inmovilizado y valor potencial del stock disponible.',
  },
  {
    id: 'top-products',
    title: 'Top productos',
    description: 'Ranking real por unidades vendidas e ingresos.',
  },
  {
    id: 'business-mix',
    title: 'Mix del período',
    description: 'Ventas por categoría y clientes que más compraron.',
  },
  {
    id: 'payment-methods',
    title: 'Metodos de pago',
    description: 'Distribucion de ingresos por metodo.',
  },
  {
    id: 'operational-snapshot',
    title: 'Snapshot operativo',
    description: 'Clientes, canjes y estado del inventario actual.',
  },
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

function formatChange(value: number | null) {
  if (value === null) {
    return 'Sin base anterior';
  }

  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(value);

  return `${formatted}%`;
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

function downloadCsv(report: ReportsOverview, visibleWidgetIds: ReportsWidgetId[]) {
  const csv = buildReportsCsv(report, visibleWidgetIds);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reportes-${report.filters.rangeKey}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

function moveWidget(
  preferences: ReportsWidgetPreferences,
  widgetId: ReportsWidgetId,
  direction: 'up' | 'down'
) {
  const currentIndex = preferences.widgetOrder.indexOf(widgetId);
  if (currentIndex === -1) {
    return preferences;
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= preferences.widgetOrder.length) {
    return preferences;
  }

  const nextOrder = [...preferences.widgetOrder];
  const [movedWidget] = nextOrder.splice(currentIndex, 1);
  if (!movedWidget) {
    return preferences;
  }
  nextOrder.splice(targetIndex, 0, movedWidget);

  return {
    ...preferences,
    widgetOrder: nextOrder,
  };
}

function getVisibleWidgetIdsInOrder(preferences: ReportsWidgetPreferences) {
  return preferences.widgetOrder.filter((widgetId) =>
    preferences.visibleWidgetIds.includes(widgetId)
  );
}

export const Reports: React.FC = () => {
  const { user, backendStatus, backendMessage, appSession } = useAppContext();
  const [appliedRange, setAppliedRange] = useState(() => {
    const initialWindow = getRangeWindow('this_month');
    return {
      rangeKey: 'this_month' as ReportsRangeKey,
      startDate: initialWindow.startDate,
      endDate: initialWindow.endDate,
    };
  });
  const [customRange, setCustomRange] = useState(createDefaultCustomRange);
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [widgetPreferences, setWidgetPreferences] = useState<ReportsWidgetPreferences>(
    getDefaultReportsWidgetPreferences
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const backendReady =
    backendStatus === 'ready' &&
    !!appSession?.store &&
    !appSession.onboardingRequired;

  const visibleWidgetIds = getVisibleWidgetIdsInOrder(widgetPreferences);
  const canExport = Boolean(report) && !isLoading && visibleWidgetIds.length > 0;

  useEffect(() => {
    if (!user || !appSession?.store?.id) {
      setWidgetPreferences(getDefaultReportsWidgetPreferences());
      setPreferencesLoaded(false);
      return;
    }

    setWidgetPreferences(readStoredReportsWidgetPreferences(user.uid, appSession.store.id));
    setPreferencesLoaded(true);
  }, [appSession?.store?.id, user]);

  useEffect(() => {
    if (!preferencesLoaded || !user || !appSession?.store?.id) {
      return;
    }

    writeStoredReportsWidgetPreferences(user.uid, appSession.store.id, widgetPreferences);
  }, [appSession?.store?.id, preferencesLoaded, user, widgetPreferences]);

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
        const nextReport = await fetchReportsOverview(user, {
          rangeKey: appliedRange.rangeKey,
          startDate: appliedRange.startDate,
          endDate: appliedRange.endDate,
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
  }, [appliedRange.endDate, appliedRange.rangeKey, appliedRange.startDate, backendReady, user]);

  const handlePresetSelect = (rangeKey: Exclude<ReportsRangeKey, 'custom'>) => {
    const nextWindow = getRangeWindow(rangeKey);
    setAppliedRange({
      rangeKey,
      startDate: nextWindow.startDate,
      endDate: nextWindow.endDate,
    });
    setCustomRangeError(null);
    setError(null);
  };

  const handleApplyCustomRange = () => {
    const nextError = getCustomRangeError(customRange.startDate, customRange.endDate);
    if (nextError) {
      setCustomRangeError(nextError);
      return;
    }

    setAppliedRange({
      rangeKey: 'custom',
      startDate: parseDateInputBoundary(customRange.startDate, 'start'),
      endDate: parseDateInputBoundary(customRange.endDate, 'end'),
    });
    setCustomRangeError(null);
    setError(null);
  };

  const toggleWidgetVisibility = (widgetId: ReportsWidgetId) => {
    setWidgetPreferences((currentPreferences) => {
      const isVisible = currentPreferences.visibleWidgetIds.includes(widgetId);
      return {
        ...currentPreferences,
        visibleWidgetIds: isVisible
          ? currentPreferences.visibleWidgetIds.filter((currentId) => currentId !== widgetId)
          : [...currentPreferences.visibleWidgetIds, widgetId],
      };
    });
  };

  const handleMoveWidget = (widgetId: ReportsWidgetId, direction: 'up' | 'down') => {
    setWidgetPreferences((currentPreferences) => moveWidget(currentPreferences, widgetId, direction));
  };

  const resetWidgetPreferences = () => {
    setWidgetPreferences({
      visibleWidgetIds: [...DEFAULT_VISIBLE_REPORTS_WIDGET_IDS],
      widgetOrder: [...REPORTS_WIDGET_IDS],
    });
  };

  const renderWidget = (widgetId: ReportsWidgetId) => {
    if (!report) {
      return null;
    }

    switch (widgetId) {
      case 'sales-summary':
        return <SalesSummaryWidget report={report} />;
      case 'sales-by-period':
        return <SalesByPeriodWidget report={report} />;
      case 'inventory-value':
        return <InventoryValueWidget report={report} />;
      case 'top-products':
        return <TopProductsWidget report={report} />;
      case 'business-mix':
        return <BusinessMixWidget report={report} />;
      case 'payment-methods':
        return <PaymentMethodsWidget report={report} />;
      case 'operational-snapshot':
        return <OperationalSnapshotWidget report={report} />;
      default:
        return null;
    }
  };

  return (
    <>
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
              {backendMessage || 'Esperando contexto de tienda y conexion backend para calcular metricas reales.'}
            </p>
          </motion.div>
        )}

        <motion.div variants={item} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reportes</h1>
              <p className="mt-1 text-sm text-gray-500">
                Métricas de {appSession?.store?.name || 'tu tienda'} con ventas, stock, clientes y canjes del período.
              </p>
              {report && (
                <p className="mt-2 text-xs text-gray-400">
                  {formatDateLabel(report.filters.startDate)}
                  {report.filters.endDate ? ` -> ${formatDateLabel(report.filters.endDate)}` : ''}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsCustomizeOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Settings2 size={16} />
                Personalizar
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => report && downloadCsv(report, visibleWidgetIds)}
                disabled={!canExport}
                className="flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Download size={16} />
                Exportar visible
              </motion.button>
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {PRESET_REPORTS_RANGE_KEYS.map((rangeKey) => (
                <motion.button
                  key={rangeKey}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePresetSelect(rangeKey)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    appliedRange.rangeKey === rangeKey
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar size={16} />
                    {rangeOptionLabels[rangeKey]}
                  </span>
                </motion.button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Desde</label>
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(event) => setCustomRange((current) => ({ ...current, startDate: event.target.value }))}
                  className={`w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm transition-all focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-black/10 ${
                    appliedRange.rangeKey === 'custom' ? 'border-black/20' : 'border-gray-200'
                  }`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Hasta</label>
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(event) => setCustomRange((current) => ({ ...current, endDate: event.target.value }))}
                  className={`w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm transition-all focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-black/10 ${
                    appliedRange.rangeKey === 'custom' ? 'border-black/20' : 'border-gray-200'
                  }`}
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApplyCustomRange}
                className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
              >
                Aplicar
              </motion.button>
            </div>
          </div>

          {customRangeError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {customRangeError}
            </div>
          )}
        </motion.div>

        {isLoading && (
          <motion.div variants={item} className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
              <p className="text-sm font-medium">Calculando metricas reales...</p>
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

        {!isLoading && !error && report && visibleWidgetIds.length === 0 && (
          <motion.div variants={item}>
            <EmptyPanel
              message="No hay widgets visibles. Abri Personalizar para volver a mostrar bloques del reporte."
            />
          </motion.div>
        )}

        {!isLoading && !error && report && visibleWidgetIds.length > 0 && (
          visibleWidgetIds.map((widgetId) => (
            <motion.div key={widgetId} variants={item}>
              {renderWidget(widgetId)}
            </motion.div>
          ))
        )}
      </motion.div>

      <Modal isOpen={isCustomizeOpen} onClose={() => setIsCustomizeOpen(false)} title="Personalizar reportes">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Elegi que widgets mostrar, reordena el layout y deja guardada esta vista en este navegador.
          </p>

          <div className="space-y-3">
            {widgetPreferences.widgetOrder.map((widgetId, index) => {
              const widget = widgetCatalog.find((entry) => entry.id === widgetId);
              const isVisible = widgetPreferences.visibleWidgetIds.includes(widgetId);
              if (!widget) {
                return null;
              }

              return (
                <div key={widgetId} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{widget.title}</p>
                        <span
                          className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
                            isVisible ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {isVisible ? 'Visible' : 'Oculto'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{widget.description}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleMoveWidget(widgetId, 'up')}
                        disabled={index === 0}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                      >
                        <span className="flex items-center gap-2">
                          <ArrowUp size={16} />
                          Subir
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveWidget(widgetId, 'down')}
                        disabled={index === widgetPreferences.widgetOrder.length - 1}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                      >
                        <span className="flex items-center gap-2">
                          <ArrowDown size={16} />
                          Bajar
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleWidgetVisibility(widgetId)}
                        className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                          isVisible
                            ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                            : 'bg-black text-white hover:bg-gray-800'
                        }`}
                      >
                        {isVisible ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-between gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={resetWidgetPreferences}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Resetear layout
            </button>
            <button
              type="button"
              onClick={() => setIsCustomizeOpen(false)}
              className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

const SalesSummaryWidget: React.FC<{ report: ReportsOverview }> = ({ report }) => (
  <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
    <div>
      <h2 className="text-lg font-bold text-gray-900">Resumen de ventas</h2>
      <p className="text-sm text-gray-500">KPI principales del periodo visible.</p>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Ingresos del rango"
        value={formatCurrency(report.summary.revenue)}
        description={`${report.summary.unitsSold} ventas completadas`}
        icon={<DollarSign size={18} className="text-emerald-600" />}
      />
      <StatCard
        title="Margen estimado"
        value={formatCurrency(report.summary.grossProfit)}
        description={`${report.summary.marginRate.toFixed(1)}% sobre lo vendido`}
        icon={<TrendingUp size={18} className="text-black" />}
      />
      <StatCard
        title="Ticket promedio"
        value={formatCurrency(report.summary.averageTicket)}
        description={`${report.summary.pendingSales} pendientes por ${formatCurrency(report.summary.pendingAmount)}`}
        icon={<Wallet size={18} className="text-gray-700" />}
      />
      <StatCard
        title="Canjes aprobados"
        value={String(report.summary.approvedTradeIns)}
        description={`${report.tradeIns.openInRange} en curso · ${formatCurrency(report.tradeIns.cashGenerated)} cobrados`}
        icon={<RefreshCw size={18} className="text-amber-600" />}
      />
    </div>
    <ComparisonStrip report={report} />
  </section>
);

const ComparisonStrip: React.FC<{ report: ReportsOverview }> = ({ report }) => {
  if (!report.comparison.available) {
    return (
      <p className="text-sm text-gray-500">
        El histórico completo no se compara con un período anterior.
      </p>
    );
  }

  const deltas = [
    { label: 'Ingresos', change: report.comparison.revenueChange, previous: formatCurrency(report.comparison.revenue) },
    { label: 'Margen', change: report.comparison.grossProfitChange, previous: formatCurrency(report.comparison.grossProfit) },
    { label: 'Unidades', change: report.comparison.unitsChange, previous: String(report.comparison.unitsSold) },
    { label: 'Ticket', change: report.comparison.averageTicketChange, previous: formatCurrency(report.comparison.averageTicket) },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {deltas.map((delta) => (
        <div key={delta.label} className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{delta.label}</p>
          <p className={`mt-1 text-sm font-bold ${changeTone(delta.change)}`}>{formatChange(delta.change)}</p>
          <p className="mt-1 text-xs text-gray-500">Antes {delta.previous}</p>
        </div>
      ))}
    </div>
  );
};

function changeTone(value: number | null) {
  if (value === null || value === 0) {
    return 'text-gray-700';
  }

  return value > 0 ? 'text-emerald-700' : 'text-red-700';
}

const SalesByPeriodWidget: React.FC<{ report: ReportsOverview }> = ({ report }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-6">
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Ventas por periodo</h2>
        <p className="text-sm text-gray-500">Grafico principal y tabla corta del rango visible.</p>
      </div>
      <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        {report.salesSeries.length} periodos
      </div>
    </div>

    {report.salesSeries.length === 0 ? (
      <EmptyPanel message="Todavia no hay ventas completadas para este rango." />
    ) : (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
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

        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
          <h3 className="text-sm font-bold text-gray-900">Tabla compacta</h3>
          <p className="mt-1 text-sm text-gray-500">Ultimos periodos visibles del reporte.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-3 font-semibold">Periodo</th>
                  <th className="pb-3 font-semibold">Ingresos</th>
                  <th className="pb-3 font-semibold">Unidades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.salesSeries.slice(-6).reverse().map((point) => (
                  <tr key={point.label} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{point.label}</td>
                    <td className="py-3 text-gray-600">{formatCurrency(point.revenue)}</td>
                    <td className="py-3 text-gray-600">{point.unitsSold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}
  </section>
);

const InventoryValueWidget: React.FC<{ report: ReportsOverview }> = ({ report }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-6">
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Valor de inventario</h2>
        <p className="text-sm text-gray-500">Lectura actual del stock disponible de la tienda.</p>
      </div>
      <Package size={18} className="text-gray-400" />
    </div>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <HighlightCard
        title="Costo del stock disponible"
        value={formatCurrency(report.inventory.valuation.costValue)}
        description={`${report.inventory.availableItems} equipos listos para vender`}
      />
      <HighlightCard
        title="Valor potencial de venta"
        value={formatCurrency(report.inventory.valuation.retailValue)}
        description="Suma de precios de venta del stock disponible"
      />
    </div>

    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      <MetricRow label="Stock total" value={String(report.inventory.totalItems)} />
      <MetricRow label="Vendidos" value={String(report.inventory.soldItems)} />
      <MetricRow label="En revisión" value={String(report.inventory.inReviewItems)} />
    </div>

    <div className="mt-6">
      <h3 className="text-sm font-bold text-gray-900">Antigüedad del stock disponible</h3>
      <p className="mt-1 text-sm text-gray-500">Cuánto hace que cada equipo disponible está en la tienda.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {report.inventory.aging.map((bucket) => (
          <div key={bucket.label} className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{bucket.label}</p>
            <p className="mt-1 text-lg font-black text-gray-900">{bucket.count}</p>
            <p className="text-xs text-gray-500">{formatCurrency(bucket.costValue)} de costo</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const BusinessMixWidget: React.FC<{ report: ReportsOverview }> = ({ report }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-6">
    <div className="mb-6">
      <h2 className="text-lg font-bold text-gray-900">Mix del período</h2>
      <p className="text-sm text-gray-500">De dónde salieron las ventas completadas del rango.</p>
    </div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Por categoría</h3>
        {report.categories.length === 0 ? (
          <EmptyPanel message="No hay ventas completadas para agrupar por categoría." compact />
        ) : (
          <div className="mt-3 space-y-3">
            {report.categories.map((category) => (
              <div key={category.category} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{category.category}</p>
                    <p className="text-xs text-gray-500">{category.unitsSold} equipos</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(category.revenue)}</p>
                    <p className="text-xs text-gray-500">{category.share.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-900">Clientes que más compraron</h3>
        {report.topClients.length === 0 ? (
          <EmptyPanel message="Todavía no hay clientes asociados a ventas de este rango." compact />
        ) : (
          <div className="mt-3 space-y-3">
            {report.topClients.map((client) => (
              <div key={client.client} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{client.client}</p>
                  <p className="text-xs text-gray-500">{client.purchases} compras</p>
                </div>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(client.revenue)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </section>
);

const TopProductsWidget: React.FC<{ report: ReportsOverview }> = ({ report }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-6">
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Top productos</h2>
        <p className="text-sm text-gray-500">Ranking del rango visible por unidades vendidas.</p>
      </div>
      <TrendingUp size={18} className="text-gray-400" />
    </div>

    {report.topProducts.length === 0 ? (
      <EmptyPanel message="No hay productos vendidos todavia en este rango." compact />
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500">
              <th className="pb-4 font-semibold">Producto</th>
              <th className="pb-4 font-semibold">Unidades</th>
              <th className="pb-4 font-semibold">Ingresos</th>
              <th className="pb-4 font-semibold">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.topProducts.map((product) => (
              <tr key={product.product} className="hover:bg-gray-50 transition-colors">
                <td className="py-4 font-medium text-gray-900">{product.product}</td>
                <td className="py-4 text-gray-600">{product.unitsSold}</td>
                <td className="py-4 text-gray-600">{formatCurrency(product.revenue)}</td>
                <td className="py-4 text-gray-600">{product.share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const PaymentMethodsWidget: React.FC<{ report: ReportsOverview }> = ({ report }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-6">
    <div className="mb-4">
      <h2 className="text-lg font-bold text-gray-900">Metodos de pago</h2>
      <p className="text-sm text-gray-500">Distribucion de ingresos del rango visible.</p>
    </div>
    {report.paymentMethods.length === 0 ? (
      <EmptyPanel message="Todavia no hay pagos registrados para este rango." compact />
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
  </section>
);

const OperationalSnapshotWidget: React.FC<{ report: ReportsOverview }> = ({ report }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-6">
    <div className="mb-6">
      <h2 className="text-lg font-bold text-gray-900">Snapshot operativo</h2>
      <p className="text-sm text-gray-500">Clientes, canjes e inventario actuales del store.</p>
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <MetricRow label="Clientes activos" value={String(report.clients.activeClients)} />
      <MetricRow label="Clientes totales" value={String(report.clients.totalClients)} />
      <MetricRow label="Saldo pendiente" value={formatCurrency(report.clients.pendingBalance)} />
      <MetricRow label="Canjes en rango" value={String(report.tradeIns.totalInRange)} />
      <MetricRow label="Canjes en curso" value={String(report.tradeIns.openInRange)} />
      <MetricRow label="Canjes aprobados" value={String(report.tradeIns.approvedInRange)} />
      <MetricRow label="Caja por canjes" value={formatCurrency(report.tradeIns.cashGenerated)} />
      <MetricRow label="Stock total" value={String(report.inventory.totalItems)} />
      <MetricRow label="Disponibles" value={String(report.inventory.availableItems)} />
      <MetricRow label="En revision" value={String(report.inventory.inReviewItems)} />
    </div>
  </section>
);

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

const HighlightCard: React.FC<{ title: string; value: string; description: string }> = ({
  title,
  value,
  description,
}) => (
  <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
    <div className="text-xs font-bold uppercase tracking-wide text-gray-400">{title}</div>
    <div className="mt-2 text-3xl font-black text-gray-900">{value}</div>
    <p className="mt-2 text-sm text-gray-500">{description}</p>
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
  <div
    className={`flex items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-4 text-center text-sm text-gray-500 ${
      compact ? 'min-h-[120px]' : 'min-h-[240px]'
    }`}
  >
    {message}
  </div>
);
