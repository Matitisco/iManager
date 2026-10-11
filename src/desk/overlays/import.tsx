import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { IMEI_OPTIONAL_LABEL } from '../../lib/imei';
import { ImportModal } from '../../components/ImportModal';
import { importBackendRows, suggestImportMapping, type ImportSection, type InventoryImportRow } from '../../services/import-api';
import { usePhoneLayout } from '../section-notices';
import { signalDesk, useDesk } from '../ui';

export function ImportHost({ kind }: { kind: 'inv' | 'sale' | 'cl' | 'cj' }) {
  const phone = usePhoneLayout();
  const { user, reloadInventory, reloadSales, reloadClients, reloadTradeIns } = useAppContext();
  const { close, toast } = useDesk();
  const config = useMemo(() => importConfig(kind, async () => {
    if (kind === 'inv') await reloadInventory();
    if (kind === 'sale') await reloadSales();
    if (kind === 'cl') await reloadClients();
    if (kind === 'cj') await reloadTradeIns();
  }), [kind, reloadInventory, reloadSales, reloadClients, reloadTradeIns]);
  if (!user) return null;
  const noun: Record<typeof kind, [string, string]> = {
    inv: ['equipo importado', 'equipos importados'],
    sale: ['venta importada', 'ventas importadas'],
    cl: ['cliente importado', 'clientes importados'],
    cj: ['canje importado', 'canjes importados'],
  };
  return <ImportModal title={config.title} fields={config.fields} mapHints={config.hints} sheet={phone} onClose={close} onSuggest={(columns) => suggestImportMapping(user, sectionFor(kind), columns)} onImport={async (rows) => {
    const result = await config.onImport(user, rows);
    const count = (result.imported ?? 0) + (result.updated ?? 0);
    toast(`${count} ${count === 1 ? noun[kind][0] : noun[kind][1]}`);
    if (kind === 'inv') signalDesk('desk-check', 'inv');
    if (kind === 'sale') signalDesk('desk-check', 'ven');
    return result;
  }} />;
}

function sectionFor(kind: 'inv' | 'sale' | 'cl' | 'cj'): ImportSection {
  if (kind === 'inv') return 'inventory';
  if (kind === 'sale') return 'sales';
  if (kind === 'cl') return 'clients';
  return 'trade-ins';
}

function importConfig(kind: 'inv' | 'sale' | 'cl' | 'cj', after: () => Promise<void>) {
  if (kind === 'inv') {
    return {
      title: 'Importar equipos',
      fields: [
        { key: 'model', label: 'Modelo', required: true },
        { key: 'imei', label: IMEI_OPTIONAL_LABEL, required: false },
        { key: 'price', label: 'Precio', required: false },
        { key: 'capacity', label: 'Capacidad', required: false },
        { key: 'color', label: 'Color', required: false },
        { key: 'condition', label: 'Condición', required: false },
        { key: 'grade', label: 'Calidad', required: false, hint: 'A+ / A / B / C. Solo aplica si la condición es USADO' },
        { key: 'batteryHealth', label: 'Batería', required: false },
        { key: 'cost', label: 'Costo', required: false },
        { key: 'status', label: 'Estado', required: false },
      ],
      hints: { modelo: 'model', imei: 'imei', precio: 'price', capacidad: 'capacity', color: 'color', colour: 'color', colores: 'color', condicion: 'condition', grado: 'grade', bateria: 'batteryHealth', costo: 'cost', estado: 'status' },
      onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[]) => {
        const parseNum = (value?: string) => value ? Number(value.replace(/\./g, '').replace(',', '.')) || 0 : undefined;
        const payload: InventoryImportRow[] = rows.map((row) => ({
          imei: row.imei ?? '',
          model: row.model ?? '',
          price: parseNum(row.price) ?? 0,
          capacity: row.capacity,
          color: row.color,
          condition: row.condition,
          grade: row.grade,
          batteryHealth: row.batteryHealth,
          cost: parseNum(row.cost),
          status: row.status,
        }));
        const result = await importBackendRows(user, 'inventory', payload);
        await after();
        return result;
      },
    };
  }
  if (kind === 'sale') {
    return {
      title: 'Importar ventas',
      fields: [
        { key: 'clientName', label: 'Cliente', required: false },
        { key: 'productImei', label: IMEI_OPTIONAL_LABEL, required: false },
        { key: 'amount', label: 'Total', required: false },
        { key: 'date', label: 'Fecha', required: false },
        { key: 'paymentMethod', label: 'Pago', required: false },
        { key: 'status', label: 'Estado', required: false },
      ],
      hints: { cliente: 'clientName', imei: 'productImei', total: 'amount', fecha: 'date', pago: 'paymentMethod', estado: 'status' },
      onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[]) => {
        const result = await importBackendRows(user, 'sales', rows);
        await after();
        return result;
      },
    };
  }
  if (kind === 'cl') {
    return {
      title: 'Importar clientes',
      fields: [
        { key: 'name', label: 'Nombre', required: true },
        { key: 'dni', label: 'DNI', required: false },
        { key: 'phone', label: 'Teléfono', required: false },
        { key: 'email', label: 'Email', required: false },
      ],
      hints: { nombre: 'name', dni: 'dni', telefono: 'phone', email: 'email' },
      onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[]) => {
        const result = await importBackendRows(user, 'clients', rows);
        await after();
        return result;
      },
    };
  }
  return {
    title: 'Importar canjes',
    fields: [
      { key: 'clientName', label: 'Cliente', required: true },
      { key: 'deviceReceived', label: 'Equipo recibido', required: true },
      { key: 'deviceReceivedImei', label: IMEI_OPTIONAL_LABEL, required: false },
      { key: 'takeValue', label: 'Valor tomado', required: false },
      { key: 'deviceGiven', label: 'Equipo entregado', required: true },
      { key: 'differencePaid', label: 'Diferencia', required: false },
      { key: 'status', label: 'Estado', required: false },
    ],
    hints: { cliente: 'clientName', recibido: 'deviceReceived', imei: 'deviceReceivedImei', valor: 'takeValue', entrega: 'deviceGiven', diferencia: 'differencePaid', estado: 'status' },
    onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[]) => {
      const result = await importBackendRows(user, 'trade-ins', rows);
      await after();
      return result;
    },
  };
}
