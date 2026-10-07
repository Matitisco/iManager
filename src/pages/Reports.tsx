import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppContext } from '../context/AppContext';
import { formatArDate, parseArDate } from '../lib/ar-date';
import { fetchReportsOverview } from '../services/reports-api';
import type { ReportsOverview, ReportsRangeKey } from '../types/reports';
import {
  createDefaultCustomRange,
  foldDailySeriesByWeek,
  formatDateInputValue,
  getCustomRangeError,
  getRangeWindow,
  parseDateInputBoundary,
} from '../utils/reports';

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } },
};

const SLICE_COLORS = ['#111111', '#0F766E', '#E11D48', '#D97706', '#2563EB', '#7C3AED'];
const BAR_MUTED = '#D4D4D4';
const BAR_CURRENT = '#111111';

type ModuleId = 'stock' | 'tradeins' | 'sales';
type PeriodId = 'week' | 'month' | 'quarter' | 'year' | 'custom';
type MetricId = 'amount' | 'units';
type SliceMode = 'primary' | 'secondary';

interface ChartPoint {
  label: string;
  axisLabel: string;
  amount: number;
  units: number;
  value: number;
  current: boolean;
}

interface ChartSlice {
  label: string;
  value: number;
  display: string;
  share: number;
  color: string;
}

const modules: Array<{ id: ModuleId; label: string }> = [
  { id: 'stock', label: 'Stock' },
  { id: 'tradeins', label: 'Canjes' },
  { id: 'sales', label: 'Ventas' },
];

const periods: Array<{ id: Exclude<PeriodId, 'custom'>; label: string }> = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'quarter', label: '3 meses' },
  { id: 'year', label: 'Año' },
];

const periodTitle: Record<PeriodId, string> = {
  week: 'últimos 7 días',
  month: 'últimos 30 días',
  quarter: 'últimos 3 meses',
  year: 'este año',
  custom: 'rango elegido',
};

const comparisonTitle: Record<PeriodId, string> = {
  week: 'vs. 7 días anteriores',
  month: 'vs. 30 días anteriores',
  quarter: 'vs. 90 días anteriores',
  year: 'vs. período anterior',
  custom: 'vs. período anterior',
};

const statusOptions: Record<ModuleId, Array<{ id: string; label: string }>> = {
  sales: [
    { id: 'all', label: 'Todas' },
    { id: 'completed', label: 'Completadas' },
    { id: 'pending', label: 'Pendientes' },
  ],
  tradeins: [
    { id: 'all', label: 'Todas' },
    { id: 'approved', label: 'Aprobadas' },
    { id: 'pending', label: 'Pendientes' },
  ],
  stock: [
    { id: 'all', label: 'Todas' },
    { id: 'available', label: 'Disponibles' },
    { id: 'review', label: 'En revisión' },
  ],
};

const metricOptions: Record<ModuleId, Array<{ id: MetricId; label: string }>> = {
  sales: [
    { id: 'amount', label: 'Monto' },
    { id: 'units', label: 'Unidades' },
  ],
  stock: [
    { id: 'amount', label: 'Valor' },
    { id: 'units', label: 'Unidades' },
  ],
  tradeins: [
    { id: 'amount', label: 'Diferencia' },
    { id: 'units', label: 'Cantidad' },
  ],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value);
}

function formatCompactAmount(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$ ${millions.toLocaleString('es-AR', {
      minimumFractionDigits: millions >= 10 ? 1 : 2,
      maximumFractionDigits: millions >= 10 ? 1 : 2,
    })}M`;
  }

  return formatCurrency(value);
}

function formatAxisAmount(value: number) {
  if (!value) {
    return '$ 0';
  }

  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$ ${millions.toLocaleString('es-AR', { maximumFractionDigits: millions >= 10 ? 0 : 1 })}M`;
  }

  if (Math.abs(value) >= 1_000) {
    const thousands = value / 1_000;
    return `$ ${thousands.toLocaleString('es-AR', { maximumFractionDigits: thousands >= 10 ? 0 : 1 })}K`;
  }

  return formatCurrency(value);
}

function formatBadge(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(rounded)}%`;
}

function formatShare(share: number) {
  const rounded = Math.round(share);
  if (rounded === 0 && share > 0) {
    return '<1%';
  }

  return `${rounded}%`;
}

function countLabel(count: number, singular: string, plural: string) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return 'Sin fecha';
  }

  const date = parseArDate(value) ?? new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : formatArDate(date);
}

function buildPresetRange(preset: Exclude<PeriodId, 'custom'>) {
  if (preset === 'quarter') {
    const window = getRangeWindow('last_90_days');
    return { rangeKey: 'last_90_days' as ReportsRangeKey, ...window };
  }

  if (preset === 'year') {
    const window = getRangeWindow('this_year');
    return { rangeKey: 'this_year' as ReportsRangeKey, ...window };
  }

  const days = preset === 'week' ? 7 : 30;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  return {
    rangeKey: 'custom' as ReportsRangeKey,
    startDate: parseDateInputBoundary(formatDateInputValue(start), 'start'),
    endDate: parseDateInputBoundary(formatDateInputValue(end), 'end'),
  };
}

function rangeEndsToday(endDate: string | null) {
  if (!endDate) {
    return false;
  }

  const end = new Date(endDate);
  const now = new Date();
  return (
    end.getFullYear() === now.getFullYear() &&
    end.getMonth() === now.getMonth() &&
    end.getDate() === now.getDate()
  );
}

function buildSlices(
  entries: Array<{ label: string; value: number }>,
  format: (value: number) => string
): ChartSlice[] {
  const total = entries.reduce((sum, entry) => sum + Math.max(entry.value, 0), 0);

  return entries
    .filter((entry) => entry.value > 0)
    .sort((left, right) => right.value - left.value)
    .map((entry, index) => ({
      label: entry.label,
      value: entry.value,
      display: format(entry.value),
      share: total > 0 ? (entry.value / total) * 100 : 0,
      color: SLICE_COLORS[index % SLICE_COLORS.length] ?? BAR_CURRENT,
    }));
}

function applyMetric(points: ChartPoint[], metric: MetricId, keepZeroCurrent: boolean) {
  const valued = points.map((point) => ({
    ...point,
    value: metric === 'amount' ? point.amount : point.units,
  }));

  if (keepZeroCurrent || valued.some((point) => point.current && point.value > 0)) {
    return valued;
  }

  let fallbackIndex = -1;
  valued.forEach((point, index) => {
    if (point.value > 0) {
      fallbackIndex = index;
    }
  });

  if (fallbackIndex === -1) {
    return valued;
  }

  return valued.map((point, index) => ({ ...point, current: index === fallbackIndex }));
}

function point(label: string, amount: number, units: number, current = false): ChartPoint {
  return { label, axisLabel: label, amount, units, value: 0, current };
}

function salesPoints(report: ReportsOverview, endsToday: boolean, compactAxis: boolean) {
  const folded = foldDailySeriesByWeek(report.salesSeries);
  return folded.map((entry, index) => {
    const label = entry.label;
    const current = index === folded.length - 1;
    return {
      label,
      axisLabel: current && endsToday && !compactAxis ? `${label} · hoy` : label,
      amount: entry.revenue,
      units: entry.unitsSold,
      value: 0,
      current,
    };
  });
}

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return narrow;
}

function visibleTickIndexes(length: number, currentIndex: number, compact: boolean) {
  const indexes = new Set<number>();
  if (compact && length > 4) {
    indexes.add(0);
    indexes.add(length - 1);
    if (currentIndex >= 0) {
      indexes.add(currentIndex);
    }
    return indexes;
  }

  if (length <= 6) {
    for (let index = 0; index < length; index += 1) {
      indexes.add(index);
    }
  } else {
    indexes.add(0);
    indexes.add(length - 1);
    for (let step = 1; step < 4; step += 1) {
      indexes.add(Math.round((step * (length - 1)) / 4));
    }
  }

  if (currentIndex >= 0) {
    indexes.add(currentIndex);
  }

  return indexes;
}

export const Reports: React.FC = () => {
  const { user, backendStatus, backendMessage, appSession } = useAppContext();
  const [period, setPeriod] = useState<PeriodId>('month');
  const [appliedRange, setAppliedRange] = useState(() => buildPresetRange('month'));
  const [customRange, setCustomRange] = useState(createDefaultCustomRange);
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);
  const [datesOpen, setDatesOpen] = useState(false);
  const [moduleId, setModuleId] = useState<ModuleId>('sales');
  const [statusByModule, setStatusByModule] = useState<Record<ModuleId, string>>({
    sales: 'all',
    stock: 'all',
    tradeins: 'all',
  });
  const [metric, setMetric] = useState<MetricId>('amount');
  const [sliceMode, setSliceMode] = useState<SliceMode>('primary');
  const [report, setReport] = useState<ReportsOverview | null>(null);
  const compactAxis = useNarrowScreen();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backendReady = backendStatus === 'ready' && !!appSession?.store && !appSession.onboardingRequired;
  const status = statusByModule[moduleId];

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

  const view = useMemo(() => {
    if (!report) {
      return null;
    }

    return buildModuleView({
      report,
      moduleId,
      status,
      metric,
      sliceMode,
      period,
      endsToday: rangeEndsToday(report.filters.endDate),
      compactAxis,
    });
  }, [compactAxis, metric, moduleId, period, report, sliceMode, status]);

  const selectPreset = (preset: Exclude<PeriodId, 'custom'>) => {
    setPeriod(preset);
    setDatesOpen(false);
    setCustomRangeError(null);
    setAppliedRange(buildPresetRange(preset));
  };

  const applyCustomRange = () => {
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
    setPeriod('custom');
    setCustomRangeError(null);
    setDatesOpen(false);
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={item} className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Reportes</h1>

        <div role="group" aria-label="Módulo" className="flex flex-wrap gap-2">
          {modules.map((entry) => (
            <FilterChip
              key={entry.id}
              pressed={moduleId === entry.id}
              disabled={!backendReady}
              onClick={() => {
                setModuleId(entry.id);
                setSliceMode('primary');
                setMetric('amount');
              }}
            >
              {entry.label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
            {periods.map((entry) => (
              <FilterChip
                key={entry.id}
                pressed={period === entry.id && !datesOpen}
                disabled={!backendReady}
                onClick={() => selectPreset(entry.id)}
              >
                {entry.label}
              </FilterChip>
            ))}
            <FilterChip
              pressed={period === 'custom' || datesOpen}
              emphasis={period === 'custom' ? 'solid' : 'quiet'}
              disabled={!backendReady}
              onClick={() => setDatesOpen((open) => !open)}
            >
              <Calendar size={14} />
              Fechas
            </FilterChip>
          </div>

          <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
            {statusOptions[moduleId].map((entry) => (
              <FilterChip
                key={entry.id}
                pressed={status === entry.id}
                disabled={!backendReady}
                onClick={() => setStatusByModule((current) => ({ ...current, [moduleId]: entry.id }))}
              >
                {entry.label}
              </FilterChip>
            ))}
          </div>
        </div>

        {datesOpen && (
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700" htmlFor="reports-start">
                Desde
              </label>
              <input
                id="reports-start"
                type="date"
                value={customRange.startDate}
                onChange={(event) => setCustomRange((current) => ({ ...current, startDate: event.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition-all focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700" htmlFor="reports-end">
                Hasta
              </label>
              <input
                id="reports-end"
                type="date"
                value={customRange.endDate}
                onChange={(event) => setCustomRange((current) => ({ ...current, endDate: event.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition-all focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <button
              type="button"
              onClick={applyCustomRange}
              className="rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Aplicar
            </button>
          </div>
        )}

        {customRangeError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {customRangeError}
          </div>
        )}

        {period === 'custom' && report && (
          <p className="text-xs text-gray-400">
            {formatDateLabel(report.filters.startDate)} – {formatDateLabel(report.filters.endDate)}
          </p>
        )}
      </motion.div>

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
            {backendMessage || 'Esperando la tienda para calcular las métricas.'}
          </p>
        </motion.div>
      )}

      {error && (
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

      {backendReady && !error && !view && <ReportsSkeleton />}

      {view && (
        <motion.div variants={item} className={`space-y-4 ${isLoading ? 'opacity-60' : ''}`}>
          <BarPanel view={view} metric={metric} compactAxis={compactAxis} onMetric={setMetric} />
          <DonutPanel view={view} sliceMode={sliceMode} onSliceMode={setSliceMode} />
        </motion.div>
      )}
    </motion.div>
  );
};

interface ModuleViewInput {
  report: ReportsOverview;
  moduleId: ModuleId;
  status: string;
  metric: MetricId;
  sliceMode: SliceMode;
  period: PeriodId;
  endsToday: boolean;
  compactAxis: boolean;
}

interface ModuleView {
  moduleId: ModuleId;
  title: string;
  headline: string;
  change: number | null;
  caption: string;
  emptyMessage: string;
  points: ChartPoint[];
  plottedMetric: MetricId;
  noun: { singular: string; plural: string };
  markCurrent: boolean;
  sliceTitle: string;
  sliceEmpty: string;
  sliceTotal: string;
  slices: ChartSlice[];
  sliceChoices: Array<{ id: SliceMode; label: string }>;
}

function buildModuleView(input: ModuleViewInput): ModuleView {
  if (input.moduleId === 'stock') {
    return buildStockView(input);
  }

  if (input.moduleId === 'tradeins') {
    return buildTradeInView(input);
  }

  return buildSalesView(input);
}

function buildSalesView({ report, status, metric, sliceMode, period, endsToday, compactAxis }: ModuleViewInput): ModuleView {
  const pendingOnly = status === 'pending';
  const rawPoints = pendingOnly
    ? report.summary.pendingSales > 0
      ? [point('Pendientes', report.summary.pendingAmount, report.summary.pendingSales, true)]
      : []
    : salesPoints(report, endsToday, compactAxis);
  const points = applyMetric(rawPoints, metric, !pendingOnly);
  const headlineAmount = pendingOnly ? report.summary.pendingAmount : report.summary.revenue;
  const headlineUnits = pendingOnly ? report.summary.pendingSales : report.summary.unitsSold;
  const change = pendingOnly
    ? null
    : metric === 'amount'
      ? report.comparison.revenueChange
      : report.comparison.unitsChange;

  const captionParts = [
    !pendingOnly && report.comparison.available ? comparisonTitle[period] : null,
    countLabel(headlineUnits, 'venta', 'ventas'),
    status === 'all' && report.summary.pendingSales > 0
      ? countLabel(report.summary.pendingSales, 'pendiente', 'pendientes')
      : null,
  ].filter((part): part is string => Boolean(part));

  const paymentSlices = buildSlices(
    report.paymentMethods.map((method) => ({ label: method.label, value: method.revenue })),
    formatCurrency
  );
  const modelSlices = buildSlices(
    report.topProducts.map((product) => ({ label: product.product, value: product.revenue })),
    formatCurrency
  );
  const slices = pendingOnly ? [] : sliceMode === 'primary' ? paymentSlices : modelSlices;
  const sliceTotal = slices.reduce((sum, slice) => sum + slice.value, 0);

  return {
    moduleId: 'sales',
    title: `Ventas · ${periodTitle[period]}`,
    headline: metric === 'amount' ? formatCurrency(headlineAmount) : formatNumber(headlineUnits),
    change: report.comparison.available && !pendingOnly ? change : null,
    caption: captionParts.join(' · '),
    emptyMessage: pendingOnly ? 'Sin ventas pendientes en este período.' : 'Sin ventas en este período.',
    points,
    plottedMetric: metric,
    noun: { singular: 'venta', plural: 'ventas' },
    markCurrent: !pendingOnly,
    sliceTitle: sliceMode === 'primary' ? 'Por medio de pago' : 'Por modelo',
    sliceEmpty: pendingOnly
      ? 'Sin desglose de ventas pendientes.'
      : sliceMode === 'primary'
        ? 'Sin medios de pago en este período.'
        : 'Sin modelos en este período.',
    sliceTotal: formatCompactAmount(sliceTotal),
    slices,
    sliceChoices: [
      { id: 'primary', label: 'Medio de pago' },
      { id: 'secondary', label: 'Modelo' },
    ],
  };
}

function buildStockView({ report, status, metric, sliceMode, period, endsToday, compactAxis }: ModuleViewInput): ModuleView {
  const reviewOnly = status === 'review';
  const timeline = !reviewOnly && report.inventory.series ? report.inventory.series : null;
  const rawPoints = reviewOnly
    ? report.inventory.inReviewItems > 0
      ? [point('En revisión', 0, report.inventory.inReviewItems, true)]
      : []
    : timeline
      ? salesPoints({ ...report, salesSeries: timeline }, endsToday, compactAxis)
      : report.inventory.aging.map((bucket, index) =>
          point(bucket.label, bucket.costValue, bucket.count, index === 0)
        );
  const points = applyMetric(rawPoints, reviewOnly ? 'units' : metric, Boolean(timeline)).filter((entry) =>
    timeline ? true : entry.value > 0
  );
  const inboundUnits = timeline?.reduce((sum, entry) => sum + entry.unitsSold, 0) ?? report.inventory.totalItems;
  const inboundCost = timeline?.reduce((sum, entry) => sum + entry.revenue, 0) ?? report.inventory.valuation.costValue;
  const headline = reviewOnly
    ? formatNumber(report.inventory.inReviewItems)
    : metric === 'amount'
      ? formatCurrency(timeline ? inboundCost : report.inventory.valuation.costValue)
      : formatNumber(timeline ? inboundUnits : report.inventory.availableItems);
  const caption = reviewOnly
    ? 'Equipos en revisión'
    : timeline
      ? countLabel(inboundUnits, 'equipo ingresado', 'equipos ingresados')
      : `${countLabel(report.inventory.availableItems, 'equipo disponible', 'equipos disponibles')} · foto actual`;

  const stateSlices = buildSlices(
    [
      { label: 'Disponible', value: report.inventory.availableItems },
      { label: 'En revisión', value: report.inventory.inReviewItems },
      { label: 'Vendido', value: report.inventory.soldItems },
    ],
    formatNumber
  );
  const agingSlices = buildSlices(
    report.inventory.aging.map((bucket) => ({
      label: bucket.label,
      value: metric === 'amount' ? bucket.costValue : bucket.count,
    })),
    metric === 'amount' ? formatCurrency : formatNumber
  );
  const slices = sliceMode === 'primary' ? stateSlices : agingSlices;
  const sliceTotal = slices.reduce((sum, slice) => sum + slice.value, 0);

  return {
    moduleId: 'stock',
    title: reviewOnly ? 'Stock · en revisión' : timeline ? `Stock · ${periodTitle[period]}` : 'Stock · disponible ahora',
    headline,
    change: null,
    caption,
    emptyMessage: reviewOnly ? 'Sin equipos en revisión.' : timeline ? 'Sin ingresos de stock en este período.' : 'Sin stock disponible.',
    points,
    plottedMetric: reviewOnly ? 'units' : metric,
    noun: { singular: 'equipo', plural: 'equipos' },
    markCurrent: Boolean(timeline),
    sliceTitle: sliceMode === 'primary' ? 'Por estado' : 'Por antigüedad',
    sliceEmpty: 'Sin stock para este corte.',
    sliceTotal: sliceMode === 'secondary' && metric === 'amount' ? formatCompactAmount(sliceTotal) : formatNumber(sliceTotal),
    slices,
    sliceChoices: [
      { id: 'primary', label: 'Estado' },
      { id: 'secondary', label: 'Antigüedad' },
    ],
  };
}

function buildTradeInView({ report, status, metric, period, endsToday, compactAxis }: ModuleViewInput): ModuleView {
  const other = Math.max(
    0,
    report.tradeIns.totalInRange - report.tradeIns.approvedInRange - report.tradeIns.openInRange
  );
  const timeline = status === 'all' && report.tradeIns.series ? report.tradeIns.series : null;
  const allPoints = [
    point('Aprobados', report.tradeIns.cashGenerated, report.tradeIns.approvedInRange),
    point('En curso', report.tradeIns.openCash ?? 0, report.tradeIns.openInRange, true),
    point('Otros', report.tradeIns.otherCash ?? 0, other),
  ];
  const rawPoints = timeline
    ? salesPoints({ ...report, salesSeries: timeline }, endsToday, compactAxis)
    : status === 'approved'
      ? [point('Aprobados', report.tradeIns.cashGenerated, report.tradeIns.approvedInRange, true)]
      : status === 'pending'
        ? [point('En curso', 0, report.tradeIns.openInRange, true)]
        : allPoints;
  const points = timeline
    ? applyMetric(rawPoints, metric, true)
    : applyMetric(rawPoints, status === 'pending' ? 'units' : metric, false).filter((entry) => entry.value > 0);
  const headlineUnits =
    status === 'approved'
      ? report.tradeIns.approvedInRange
      : status === 'pending'
        ? report.tradeIns.openInRange
        : report.tradeIns.totalInRange;
  const tradeInCash =
    report.tradeIns.cashGenerated + (report.tradeIns.openCash ?? 0) + (report.tradeIns.otherCash ?? 0);
  const headline =
    status === 'pending' || metric === 'units'
      ? formatNumber(headlineUnits)
      : formatCurrency(status === 'approved' ? report.tradeIns.cashGenerated : tradeInCash);

  const slices = buildSlices(
    [
      { label: 'Aprobados', value: report.tradeIns.approvedInRange },
      { label: 'En curso', value: report.tradeIns.openInRange },
      { label: 'Otros', value: other },
    ],
    formatNumber
  );

  return {
    moduleId: 'tradeins',
    title: `Canjes · ${periodTitle[period]}`,
    headline,
    change: null,
    caption: `${countLabel(report.tradeIns.approvedInRange, 'aprobado', 'aprobados')} · ${countLabel(report.tradeIns.openInRange, 'en curso', 'en curso')}`,
    emptyMessage: 'Sin canjes en este período.',
    points,
    plottedMetric: status === 'pending' ? 'units' : metric,
    noun: { singular: 'canje', plural: 'canjes' },
    markCurrent: Boolean(timeline),
    sliceTitle: 'Por estado',
    sliceEmpty: 'Sin canjes en este período.',
    sliceTotal: formatNumber(slices.reduce((sum, slice) => sum + slice.value, 0)),
    slices,
    sliceChoices: [],
  };
}

function FilterChip({
  pressed,
  emphasis = 'solid',
  disabled,
  onClick,
  children,
}: {
  pressed: boolean;
  emphasis?: 'solid' | 'quiet';
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const pressedClass = emphasis === 'quiet'
    ? 'border-black bg-white text-gray-900'
    : 'border-black bg-black text-white';

  return (
    <button
      type="button"
      aria-pressed={pressed && emphasis === 'solid'}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed ? pressedClass : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function BarPanel({
  view,
  metric,
  compactAxis,
  onMetric,
}: {
  view: ModuleView;
  metric: MetricId;
  compactAxis: boolean;
  onMetric: (metric: MetricId) => void;
}) {
  const axisMetric = view.plottedMetric;
  const hasBars = view.points.some((entry) => entry.value > 0);
  const currentIndex = view.points.findIndex((entry) => entry.current);
  const ticks = visibleTickIndexes(view.points.length, currentIndex, compactAxis);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">{view.title}</p>
          <p className="mt-2 text-4xl font-black tracking-tight text-gray-900 md:text-5xl">{view.headline}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            {view.change !== null && (
              <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-bold text-gray-900">
                {formatBadge(view.change)}
              </span>
            )}
            <span>{view.caption}</span>
          </div>
        </div>

        <div role="group" aria-label="Métrica" className="flex gap-2">
          {metricOptions[view.moduleId].map((entry) => (
            <FilterChip key={entry.id} pressed={metric === entry.id} onClick={() => onMetric(entry.id)}>
              {entry.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="mt-6 h-80">
        {hasBars ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart key={view.points.map((entry) => `${entry.axisLabel}:${entry.value}`).join('|')} data={view.points} margin={{ top: 28, right: 8, left: 0, bottom: 4 }} barCategoryGap={view.points.length > 8 ? '18%' : '28%'}>
              <CartesianGrid stroke="#ececec" strokeDasharray="4 6" vertical={false} />
              <XAxis
                dataKey="axisLabel"
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={(props) => (
                  <ReportAxisTick {...props} visible={ticks} currentIndex={currentIndex} />
                )}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={56}
                allowDecimals={axisMetric === 'amount'}
                tick={{ fontSize: 12, fill: '#a3a3a3' }}
                tickFormatter={(value: number) => (axisMetric === 'amount' ? formatAxisAmount(value) : formatNumber(value))}
              />
              <Tooltip
                cursor={{ fill: 'rgba(17,17,17,0.04)' }}
                wrapperStyle={{ outline: 'none', background: 'transparent', border: 'none', boxShadow: 'none' }}
                content={(props) => (
                  <BarTooltip
                    active={props.active}
                    payload={props.payload as unknown as Array<{ payload?: ChartPoint }> | undefined}
                    metric={axisMetric}
                    singular={view.noun.singular}
                    plural={view.noun.plural}
                    markCurrent={view.markCurrent}
                  />
                )}
              />
              <Bar
                dataKey="value"
                radius={[8, 8, 0, 0]}
                maxBarSize={view.points.length <= 2 ? 112 : view.points.length <= 6 ? 84 : 36}
                activeBar={{ fill: BAR_CURRENT }}
              >
                {view.points.map((entry) => (
                  <Cell key={entry.axisLabel} fill={entry.current ? BAR_CURRENT : BAR_MUTED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">{view.emptyMessage}</div>
        )}
      </div>
    </section>
  );
}

function ReportAxisTick({
  x = 0,
  y = 0,
  payload,
  index = 0,
  visible,
  currentIndex,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
  index?: number;
  visible?: Set<number>;
  currentIndex?: number;
}) {
  if (!visible?.has(index) || !payload?.value) {
    return null;
  }

  const isCurrent = index === currentIndex;

  return (
    <text
      x={x}
      y={Number(y) + 16}
      textAnchor="middle"
      fill={isCurrent ? '#111111' : '#a3a3a3'}
      fontSize={12}
      fontWeight={isCurrent ? 700 : 500}
    >
      {payload.value}
    </text>
  );
}

function BarTooltip({
  active,
  payload,
  metric,
  singular,
  plural,
  markCurrent,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  metric: MetricId;
  singular: string;
  plural: string;
  markCurrent: boolean;
}) {
  const entry = payload?.[0]?.payload;
  if (!active || !entry) {
    return null;
  }

  const hint = markCurrent && entry.current ? ' · en curso' : '';
  const units = countLabel(entry.units, singular, plural);
  const money = formatCurrency(entry.amount);
  const primary = metric === 'amount' ? money : units;
  const secondary = metric === 'amount' ? `${units}${hint}` : entry.amount > 0 ? `${money}${hint}` : hint.replace(' · ', '');

  return (
    <div className="rounded-xl bg-black px-3 py-2 shadow-lg">
      <p className="text-sm font-bold text-white">{primary}</p>
      {secondary && <p className="mt-0.5 text-xs text-white/70">{secondary}</p>}
    </div>
  );
}

function DonutPanel({
  view,
  sliceMode,
  onSliceMode,
}: {
  view: ModuleView;
  sliceMode: SliceMode;
  onSliceMode: (mode: SliceMode) => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-gray-900">{view.sliceTitle}</h2>
        {view.sliceChoices.length > 1 && (
          <div role="group" aria-label="Corte del gráfico" className="flex gap-2">
            {view.sliceChoices.map((choice) => (
              <FilterChip key={choice.id} pressed={sliceMode === choice.id} onClick={() => onSliceMode(choice.id)}>
                {choice.label}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {view.slices.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center text-sm text-gray-400">{view.sliceEmpty}</div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-12">
          <div className="relative h-[260px] w-[260px] shrink-0 overflow-visible">
            <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-black tracking-tight text-gray-900">{view.sliceTotal}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} className="relative z-10 overflow-visible">
              <PieChart key={view.slices.map((slice) => `${slice.label}:${slice.value}`).join('|')}>
                <Pie
                  data={view.slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="68%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={view.slices.length > 1 ? 2 : 0}
                  stroke={view.slices.length > 1 ? '#ffffff' : 'transparent'}
                  strokeWidth={view.slices.length > 1 ? 3 : 0}
                  isAnimationActive
                >
                  {view.slices.map((slice) => (
                    <Cell key={slice.label} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 30, outline: 'none', background: 'transparent', border: 'none', boxShadow: 'none' }}
                  content={(props) => (
                    <SliceTooltip
                      active={props.active}
                      payload={props.payload as unknown as Array<{ payload?: ChartSlice }> | undefined}
                    />
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="flex w-full max-w-xl flex-1 flex-col gap-4">
            {view.slices.map((slice) => (
              <li key={slice.label} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{slice.label}</span>
                <span className="text-sm font-semibold tabular-nums text-gray-900">{slice.display}</span>
                <span className="w-12 text-right text-sm tabular-nums text-gray-500">{formatShare(slice.share)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SliceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartSlice }>;
}) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) {
    return null;
  }

  return (
    <div className="rounded-xl bg-black px-3 py-2 shadow-lg">
      <p className="text-sm font-bold text-white">{slice.label}</p>
      <p className="mt-0.5 text-xs text-white/70">
        {slice.display} · {formatShare(slice.share)}
      </p>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        <div className="h-4 w-40 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-4 h-12 w-56 animate-pulse rounded-2xl bg-gray-100" />
        <div className="mt-8 flex h-64 items-end gap-3">
          {['h-24', 'h-40', 'h-28', 'h-16', 'h-52'].map((height, index) => (
            <div
              key={height}
              className={`flex-1 animate-pulse rounded-t-lg ${index === 4 ? 'bg-gray-900' : 'bg-gray-200'} ${height}`}
            />
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        <div className="h-4 w-36 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-6 flex flex-col items-center gap-8 lg:flex-row">
          <div className="h-[220px] w-[220px] animate-pulse rounded-full border-[28px] border-gray-200" />
          <div className="w-full flex-1 space-y-4">
            {['w-3/4', 'w-2/3', 'w-1/2', 'w-2/5'].map((width) => (
              <div key={width} className={`h-4 animate-pulse rounded-full bg-gray-100 ${width}`} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
