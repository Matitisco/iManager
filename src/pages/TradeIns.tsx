import React, { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Banknote, Calculator, CheckCircle2 } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import { TableEngine } from '../components/table-engine';
import type { BadgeMeta, TableEngineConfig } from '../components/table-engine';
import { EditPanel } from '../components/table-engine/components/EditPanel';
import { formatCurrency, trimToString } from '../lib/utils';
import type { Client, TradeIn } from '../types';
import {
  fetchTradeInFilteredIds,
  fetchTradeInsPage,
  invalidateTradeInsCache,
  updateTradeInCategoryInCache,
} from '../services/trade-ins-table-api';
import { importBackendTradeIns } from '../services/trade-ins-import-api';
import { customFieldsFromRowForm, withCustomField } from '../utils/cell-tags';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

const TRADE_IN_STATUS_BADGE: Record<TradeIn['status'], BadgeMeta> = {
  PENDIENTE: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-400',
    label: 'Pendiente',
  },
  'EN REVISIÓN': {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    dot: 'bg-yellow-400',
    label: 'En revisión',
  },
  'PERITAJE TÉC.': {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    dot: 'bg-orange-400',
    label: 'Peritaje téc.',
  },
  LISTO: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    dot: 'bg-sky-400',
    label: 'Listo',
  },
  APROBADO: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-400',
    label: 'Aprobado',
  },
  RECHAZADO: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-400',
    label: 'Rechazado',
  },
};

type StatCardProps = {
  title: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
};

const StatCard = ({ title, value, trend, icon }: StatCardProps) => (
  <motion.div
    whileHover={{ y: -4, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
    className="bg-white p-5 rounded-2xl border border-gray-200 transition-shadow cursor-default h-full"
  >
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-xs font-bold text-gray-400 tracking-wider">{title}</h3>
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
        {icon}
      </div>
    </div>
    <div className="text-3xl font-black text-gray-900 leading-none">{value}</div>
    <span className="inline-block mt-2 text-xs font-bold text-gray-500">{trend}</span>
  </motion.div>
);

type EvaluationCardProps = {
  trade: TradeIn;
  client?: Client;
  onOpen: () => void;
};

const EvaluationCard = ({ trade, client, onOpen }: EvaluationCardProps) => (
  <motion.button
    whileHover={{ y: -4, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
    onClick={onOpen}
    className="bg-white p-4 rounded-2xl border border-gray-200 flex gap-4 transition-shadow text-left"
  >
    <div className="w-20 h-24 rounded-xl bg-gray-900/5 shrink-0 border border-gray-100 shadow-inner flex items-center justify-center text-gray-500 text-xs font-bold px-2 text-center">
      {trade.deviceReceived}
    </div>
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-1 gap-3">
          <h3 className="font-bold text-gray-900">{trade.deviceReceived}</h3>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide ${TRADE_IN_STATUS_BADGE[trade.status].bg} ${TRADE_IN_STATUS_BADGE[trade.status].text}`}>
            {TRADE_IN_STATUS_BADGE[trade.status].label}
          </span>
        </div>
        <div className="text-xs text-gray-500 space-y-0.5">
          <div className="flex justify-between gap-3">
            <span>Cliente:</span>
            <span className="font-medium text-gray-900 text-right">{client?.name || 'Sin cliente'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Batería:</span>
            <span className="font-medium text-gray-900">{trimToString(trade.batteryHealth) || 'N/D'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Grado:</span>
            <span className="font-medium text-gray-900">{trimToString(trade.grade) || 'N/D'}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">Valor estimado</span>
        <span className="font-black text-gray-900">{formatCurrency(trade.takeValue)}</span>
      </div>
    </div>
  </motion.button>
);

interface TradeInsProps {
  searchTerm?: string;
}

export const TradeIns: React.FC<TradeInsProps> = ({ searchTerm = '' }) => {
  const {
    user,
    tradeIns,
    clients,
    addTradeIn,
    updateTradeIn,
    deleteTradeIn,
    tradeInCategories,
    createTradeInCategory,
    renameTradeInCategory,
    deleteTradeInCategory,
    bulkMoveTradeInCategory,
    reorderTradeInCategories,
    customColumns,
    addCustomColumn,
    removeCustomColumn,
  } = useAppContext();
  const [selectedTradeIn, setSelectedTradeIn] = useState<TradeIn | null>(null);
  const tradeInCustomColumns = useMemo(
    () => customColumns.filter((column) => column.entity === 'trade-ins'),
    [customColumns],
  );

  const getClient = useCallback(
    (clientId: string): Client | undefined => clients.find((client) => client.id === clientId),
    [clients],
  );

  const pendingTradeIns = tradeIns.filter((trade) =>
    ['PENDIENTE', 'EN REVISIÓN', 'PERITAJE TÉC.'].includes(trade.status),
  ).length;
  const totalTakeValue = tradeIns.reduce((sum, trade) => sum + trade.takeValue, 0);
  const averageDifference =
    tradeIns.length > 0
      ? tradeIns.reduce((sum, trade) => sum + trade.differencePaid, 0) / tradeIns.length
      : 0;
  const approvedTradeIns = tradeIns.filter((trade) => trade.status === 'APROBADO').length;
  const approvalRate = tradeIns.length > 0 ? (approvedTradeIns / tradeIns.length) * 100 : 0;
  const highlightedTradeIns = useMemo(() => tradeIns.slice(0, 3), [tradeIns]);

  const clientSelectOptions = useMemo(
    () =>
      clients.map((client) => ({
        value: client.id,
        label: client.dni ? `${client.name} (${client.dni})` : client.name,
      })),
    [clients],
  );

  const dateFilterOptions = useMemo(
    () => [
      { value: '', label: 'Todas' },
      ...Array.from(new Set(tradeIns.map((trade) => trade.date)))
        .sort((left, right) => right.localeCompare(left))
        .map((date) => ({ value: date, label: date })),
    ],
    [tradeIns],
  );

  const clientFilterOptions = useMemo(
    () => [
      { value: '', label: 'Todos' },
      ...Array.from(new Set(tradeIns.map((trade) => trade.clientId)))
        .map((clientId) => {
          const client = getClient(clientId);
          return {
            value: clientId,
            label: client ? (client.dni ? `${client.name} (${client.dni})` : client.name) : 'Cliente eliminado',
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label)),
    ],
    [getClient, tradeIns],
  );

  const deviceFilterOptions = useMemo(
    () => [
      { value: '', label: 'Todos' },
      ...Array.from(new Set(tradeIns.map((trade) => trade.deviceReceived)))
        .sort((left, right) => left.localeCompare(right))
        .map((device) => ({ value: device, label: device })),
    ],
    [tradeIns],
  );

  const editPanelFields = useMemo(
    () => [
      {
        label: 'Cliente',
        field: 'clientId',
        type: 'select',
        span: 2,
        options: clientSelectOptions,
      },
      { label: 'Fecha', field: 'date', type: 'text' },
      {
        label: 'Estado',
        field: 'status',
        type: 'select',
        options: Object.entries(TRADE_IN_STATUS_BADGE).map(([value, meta]) => ({
          value,
          label: meta.label.toUpperCase(),
        })),
      },
      { label: 'Equipo Recibido', field: 'deviceReceived', type: 'text', span: 2 },
      { label: 'IMEI Recibido', field: 'deviceReceivedImei', type: 'text' },
      { label: 'Valor Toma', field: 'takeValue', type: 'number' },
      { label: 'Equipo Entregado', field: 'deviceGiven', type: 'text', span: 2 },
      { label: 'Diferencia Pagada', field: 'differencePaid', type: 'number' },
      { label: 'Batería', field: 'batteryHealth', type: 'text' },
      { label: 'Grado', field: 'grade', type: 'text' },
    ] as const,
    [clientSelectOptions],
  );

  const persistTradeInUpdate = useCallback(
    async (tradeIn: TradeIn) => {
      await updateTradeIn(tradeIn);
      invalidateTradeInsCache();
    },
    [updateTradeIn],
  );

  const persistTradeInDelete = useCallback(
    async (tradeInId: string) => {
      await deleteTradeIn(tradeInId);
      invalidateTradeInsCache();
    },
    [deleteTradeIn],
  );

  const config = useMemo(
    (): TableEngineConfig<TradeIn> => ({
      title: 'Historial de Canjes',
      storageKey: 'trade-ins',
      exportSheetName: 'Canjes',
      noun: 'canje',
      nounPlural: 'canjes',

      categories: tradeInCategories,
      onCreateCategory: createTradeInCategory,
      onRenameCategory: renameTradeInCategory,
      onDeleteCategory: deleteTradeInCategory,
      onReorderCategories: reorderTradeInCategories,
      onBulkMoveCategory: async (ids, categoryId) => {
        await bulkMoveTradeInCategory(ids, categoryId);
        updateTradeInCategoryInCache(ids, categoryId);
      },

      columns: [
        {
          id: 'date',
          field: 'date',
          label: 'Fecha',
          defaultWidth: 130,
          type: 'text',
          alwaysVisible: true,
          editable: true,
        },
        {
          id: 'clientId',
          field: 'clientId',
          label: 'Cliente',
          defaultWidth: 220,
          type: 'custom',
          alwaysVisible: true,
          editable: false,
          renderCell: (clientId: string) => {
            const client = getClient(clientId);

            return (
              <div>
                <div className="font-bold text-gray-900">{client?.name || 'Cliente eliminado'}</div>
                <div className="text-xs text-gray-400 mt-0.5">{client?.dni || 'Sin DNI'}</div>
              </div>
            );
          },
        },
        {
          id: 'deviceReceived',
          field: 'deviceReceived',
          label: 'Equipo Recibido',
          defaultWidth: 200,
          type: 'text',
          editable: true,
        },
        {
          id: 'deviceReceivedImei',
          field: 'deviceReceivedImei',
          label: 'IMEI',
          defaultWidth: 170,
          type: 'text',
          editable: true,
          tdClassName: 'text-gray-500 font-mono',
        },
        {
          id: 'takeValue',
          field: 'takeValue',
          label: 'Valor Toma',
          defaultWidth: 140,
          type: 'number',
          editable: true,
          formatDisplay: (value: number) => formatCurrency(value),
        },
        {
          id: 'deviceGiven',
          field: 'deviceGiven',
          label: 'Equipo Entregado',
          defaultWidth: 200,
          type: 'text',
          editable: true,
        },
        {
          id: 'differencePaid',
          field: 'differencePaid',
          label: 'Dif. Abonada',
          defaultWidth: 150,
          type: 'number',
          editable: true,
          formatDisplay: (value: number) => formatCurrency(value),
        },
        {
          id: 'status',
          field: 'status',
          label: 'Estado',
          defaultWidth: 150,
          type: 'badge',
          editable: true,
          enumOptions: Object.keys(TRADE_IN_STATUS_BADGE),
          badgeMeta: TRADE_IN_STATUS_BADGE,
        },
        {
          id: 'batteryHealth',
          field: 'batteryHealth',
          label: 'Batería',
          defaultWidth: 120,
          type: 'text',
          editable: true,
        formatDisplay: (value: string | undefined) => trimToString(value) || '—',
        },
        {
          id: 'grade',
          field: 'grade',
          label: 'Grado',
          defaultWidth: 100,
          type: 'text',
          editable: true,
        formatDisplay: (value: string | undefined) => trimToString(value) || '—',
        },
      ],

      filters: [
        {
          id: 'date',
          label: 'Fecha',
          param: 'date',
          defaultValue: '',
          options: dateFilterOptions,
        },
        {
          id: 'clientId',
          label: 'Cliente',
          param: 'clientId',
          defaultValue: '',
          options: clientFilterOptions,
        },
        {
          id: 'deviceReceived',
          label: 'Equipo recibido',
          param: 'deviceReceived',
          defaultValue: '',
          options: deviceFilterOptions,
        },
        {
          id: 'status',
          label: 'Estado',
          param: 'status',
          defaultValue: '',
          options: [
            { value: '', label: 'Todos' },
            ...Object.entries(TRADE_IN_STATUS_BADGE).map(([value, meta]) => ({
              value,
              label: meta.label,
            })),
          ],
        },
      ],

      sortOptions: [
        { key: 'date', label: 'Fecha' },
        { key: 'takeValue', label: 'Valor toma' },
        { key: 'differencePaid', label: 'Dif. abonada' },
        { key: 'status', label: 'Estado' },
        { key: 'deviceReceived', label: 'Equipo recibido' },
      ],

      fetchPage: (params) => fetchTradeInsPage(user!, params, clients),
      fetchFilteredIds: (params) => fetchTradeInFilteredIds(user!, params, clients),

      addRowFields: [
        {
          colId: 'clientId',
          required: true,
          selectOptions: [
            { value: '', label: 'Seleccionar cliente' },
            ...clientSelectOptions,
          ],
        },
        { colId: 'date', placeholder: 'Fecha (ej. 2026-04-08)', required: true },
        { colId: 'deviceReceived', placeholder: 'Equipo recibido', required: true },
        { colId: 'deviceReceivedImei', placeholder: 'IMEI recibido', required: true },
        { colId: 'takeValue', placeholder: 'Valor toma', required: true },
        { colId: 'deviceGiven', placeholder: 'Equipo entregado', required: true },
        { colId: 'differencePaid', placeholder: 'Diferencia abonada', required: true },
      ],
      buildNewItem: (formData, categoryId) => ({
        customFields: customFieldsFromRowForm(formData, tradeInCustomColumns),
        date: String(formData.date ?? '').trim() || new Date().toISOString().slice(0, 10),
        clientId: String(formData.clientId ?? '').trim(),
        categoryId: categoryId ?? null,
        deviceReceived: String(formData.deviceReceived ?? '').trim(),
        deviceReceivedImei: String(formData.deviceReceivedImei ?? '').trim(),
        takeValue: Number(formData.takeValue) || 0,
        deviceGiven: String(formData.deviceGiven ?? '').trim(),
        differencePaid: Number(formData.differencePaid) || 0,
        status: (formData.status as TradeIn['status']) || 'PENDIENTE',
        batteryHealth: String(formData.batteryHealth ?? '').trim(),
        grade: String(formData.grade ?? '').trim(),
      }),
      onCreate: async (data) => {
        await addTradeIn(data as Omit<TradeIn, 'id'>);
        invalidateTradeInsCache();
      },
      onUpdate: persistTradeInUpdate,
      onDelete: persistTradeInDelete,
      onBulkDelete: async (ids) => {
        await Promise.all(ids.map((id) => deleteTradeIn(id)));
        invalidateTradeInsCache();
      },
      customColumnActions: {
        onCreate: async ({ label, type }) => {
          const id = await addCustomColumn({ label, type, entity: 'trade-ins' });
          if (!id) {
            throw new Error('No se pudo crear la columna.');
          }
        },
        onDelete: async (colId) => {
          if (!colId.startsWith('dynamic:')) return;
          await removeCustomColumn(colId.replace('dynamic:', ''));
        },
        canDelete: (colId) => colId.startsWith('dynamic:'),
      },
      dynamicColumns: {
        columns: tradeInCustomColumns,
        defaultWidth: 160,
        getValue: (row, columnId) => row.customFields?.[columnId] ?? '',
        setValue: (row, columnId, value) => withCustomField(row, tradeInCustomColumns, columnId, value),
      },

      editPanelTitle: 'Editar Canje',
      editPanelFields: [...editPanelFields],
      importConfig: {
        title: 'Importar canjes',
        fields: [
          { key: 'clientName', label: 'Cliente (nombre)', required: true },
          { key: 'date', label: 'Fecha', required: false, hint: 'ej: 08 abr 2026' },
          { key: 'deviceReceived', label: 'Equipo recibido', required: true },
          { key: 'deviceReceivedImei', label: 'IMEI recibido', required: true },
          { key: 'takeValue', label: 'Valor toma', required: true },
          { key: 'deviceGiven', label: 'Equipo entregado', required: true },
          { key: 'differencePaid', label: 'Diferencia abonada', required: true },
          { key: 'status', label: 'Estado', required: false, hint: 'PENDIENTE / APROBADO / RECHAZADO' },
          { key: 'batteryHealth', label: 'Bateria', required: false, hint: 'ej: 85% o 83-85%' },
          { key: 'grade', label: 'Grado', required: false },
        ],
        mapHints: {
          cliente: 'clientName',
          nombrecliente: 'clientName',
          fecha: 'date',
          equipo: 'deviceReceived',
          equiporecibido: 'deviceReceived',
          modelo: 'deviceReceived',
          imei: 'deviceReceivedImei',
          imeirecibido: 'deviceReceivedImei',
          valortoma: 'takeValue',
          tomado: 'takeValue',
          entrega: 'deviceGiven',
          equipoentregado: 'deviceGiven',
          diferencia: 'differencePaid',
          diferenciaabonada: 'differencePaid',
          estado: 'status',
          bateria: 'batteryHealth',
          saludbateria: 'batteryHealth',
          grade: 'grade',
          grado: 'grade',
        },
        onImport: async (rows) => {
          const result = await importBackendTradeIns(user!, rows);
          invalidateTradeInsCache();
          return result;
        },
      },
    }),
    [
      addTradeIn,
      clientFilterOptions,
      clientSelectOptions,
      dateFilterOptions,
      deleteTradeIn,
      deviceFilterOptions,
      editPanelFields,
      getClient,
      persistTradeInDelete,
      persistTradeInUpdate,
      user,
      tradeInCustomColumns,
      addCustomColumn,
      removeCustomColumn,
    ],
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item}>
          <StatCard
            title="CANJES EN EVALUACIÓN"
            value={String(pendingTradeIns)}
            trend={`${tradeIns.length} totales`}
            icon={<AlertCircle size={16} className="text-amber-500" />}
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            title="VALOR RECIBIDO"
            value={formatCurrency(totalTakeValue)}
            trend="Datos reales"
            icon={<Banknote size={16} className="text-emerald-500" />}
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            title="PROMEDIO DIFERENCIA"
            value={formatCurrency(averageDifference)}
            trend="Datos reales"
            icon={<Calculator size={16} className="text-gray-500" />}
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            title="TASA APROBACIÓN"
            value={`${approvalRate.toFixed(0)}%`}
            trend={`${approvedTradeIns} aprobados`}
            icon={<CheckCircle2 size={16} className="text-gray-900" />}
          />
        </motion.div>
      </div>

      <motion.div variants={item}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-lg font-bold text-gray-900">Canjes recientes</h2>
          <span className="text-sm text-gray-500">Vista rápida de los últimos registros cargados.</span>
        </div>
        {highlightedTradeIns.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center text-gray-500">
            Todavía no hay canjes registrados para mostrar.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {highlightedTradeIns.map((trade) => (
              <EvaluationCard
                key={trade.id}
                trade={trade}
                client={getClient(trade.clientId)}
                onOpen={() => setSelectedTradeIn(trade)}
              />
            ))}
          </div>
        )}
      </motion.div>

      <motion.div
        variants={item}
        className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white h-[32rem]"
      >
        <TableEngine config={config} user={user} searchTerm={searchTerm} />
      </motion.div>

      <EditPanel
        item={selectedTradeIn}
        fields={[...editPanelFields]}
        title="Editar Canje"
        onClose={() => setSelectedTradeIn(null)}
        onChange={(updatedTradeIn) => setSelectedTradeIn(updatedTradeIn)}
        onSave={persistTradeInUpdate}
        onDelete={(tradeInId) => {
          setSelectedTradeIn(null);
          void persistTradeInDelete(tradeInId);
        }}
      />
    </motion.div>
  );
};
