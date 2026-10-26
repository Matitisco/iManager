import { useMemo, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { parseImportNumber } from '../../lib/import-number';
import { IMEI_OPTIONAL_LABEL } from '../../lib/imei';
import { ImportModal } from '../../components/ImportModal';
import { analyzeInventoryText, analyzeImport, applyImportPlan, importBackendRows, type ImportSection, type InventoryImportRow } from '../../services/import-api';
import { usePhoneLayout } from '../section-notices';
import { signalDesk, useDesk } from '../ui';

export function ImportHost({ kind, supplierId, supplierName, onSaved }: { kind: 'inv' | 'sale' | 'cl'; supplierId?: string; supplierName?: string; onSaved?: () => void | Promise<void> }) {
  const phone = usePhoneLayout();
  const source = useRef<'excel' | 'text'>('excel');
  const { user, reloadInventory, reloadSales, reloadClients, reloadLedger } = useAppContext();
  const { close, toast } = useDesk();
  const config = useMemo(() => importConfig(kind, async () => {
    if (kind === 'inv') await reloadInventory();
    if (kind === 'sale') {
      await reloadSales();
      await reloadClients();
      await reloadInventory();
    }
    if (kind === 'cl') await reloadClients();
    if (kind === 'inv' && supplierId) await reloadLedger();
  }, supplierId ? { id: supplierId, name: supplierName } : undefined), [kind, reloadInventory, reloadSales, reloadClients, reloadLedger, supplierId, supplierName]);
  if (!user) return null;
  const noun: Record<typeof kind, [string, string]> = {
    inv: ['equipo importado', 'equipos importados'],
    sale: ['venta importada', 'ventas importadas'],
    cl: ['cliente importado', 'clientes importados'],
  };
  const section = sectionFor(kind);
  return <ImportModal title={config.title} fields={config.fields} sheet={phone} nouns={config.nouns} unrelatedNotice={config.unrelatedNotice} onClose={close} onAnalyzeText={kind === 'inv' ? (text) => { source.current = 'text'; return analyzeInventoryText(user, text); } : undefined} onAnalyze={(sheets) => { source.current = 'excel'; return analyzeImport(user, section, sheets); }} onApply={(sheets, plan, refreshMapping) => applyImportPlan(user, section, sheets, plan, refreshMapping)} onImport={async (rows) => {
    const result = await config.onImport(user, rows, source.current);
    if ((result.imported ?? 0) + (result.updated ?? 0) > 0) await onSaved?.();
    const count = (result.imported ?? 0) + (result.updated ?? 0);
    if (count > 0) toast(`${count} ${count === 1 ? noun[kind][0] : noun[kind][1]}`);
    if (kind === 'inv') signalDesk('desk-check', 'inv');
    if (kind === 'sale') signalDesk('desk-check', 'ven');
    return result;
  }} />;
}

function sectionFor(kind: 'inv' | 'sale' | 'cl'): ImportSection {
  if (kind === 'inv') return 'inventory';
  if (kind === 'sale') return 'sales';
  return 'clients';
}

function importConfig(kind: 'inv' | 'sale' | 'cl', after: () => Promise<void>, supplier?: { id: string; name?: string }) {
  if (kind === 'inv') {
    return {
      title: supplier?.name ? `Subir stock de ${supplier.name}` : 'Importar equipos',
      nouns: { one: 'equipo', many: 'equipos' },
      unrelatedNotice: 'Este archivo no parece tener equipos para importar.',
      fields: [
        { key: 'model', label: 'Modelo', required: true },
        { key: 'imei', label: IMEI_OPTIONAL_LABEL, required: false },
        { key: 'price', label: 'Precio', required: false },
        { key: 'currency', label: 'Moneda', required: false },
        { key: 'capacity', label: 'Capacidad', required: false },
        { key: 'color', label: 'Color', required: false },
        { key: 'condition', label: 'Condición', required: false },
        { key: 'grade', label: 'Calidad', required: false, hint: 'A+ / A / B / C. Solo aplica si la condición es USADO' },
        { key: 'batteryHealth', label: 'Batería', required: false },
        { key: 'cost', label: 'Costo', required: false },
        { key: 'status', label: 'Estado', required: false },
      ],
      onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[], source: 'excel' | 'text') => {
        const payload: InventoryImportRow[] = rows.map((row) => ({
          imei: row.imei ?? '',
          model: row.model ?? '',
          price: parseImportNumber(row.price) ?? 0,
          capacity: row.capacity,
          color: row.color,
          condition: row.condition,
          grade: row.grade,
          batteryHealth: row.quantity ? row.batteryHealth || 'N/A' : row.batteryHealth,
          cost: parseImportNumber(row.cost),
          currency: row.currency === 'ARS' || row.currency === 'USD' ? row.currency : undefined,
          customFields: row.serial ? { serial: row.serial } : undefined,
          status: row.status,
        }));
        const result = await importBackendRows(user, 'inventory', payload, supplier?.id, source);
        await after();
        return result;
      },
    };
  }
  if (kind === 'sale') {
    return {
      title: 'Importar ventas',
      nouns: { one: 'venta', many: 'ventas' },
      unrelatedNotice: 'Este archivo no parece tener ventas para importar.',
      fields: [
        { key: 'date', label: 'Fecha', required: false },
        { key: 'clientName', label: 'Cliente', required: false },
        { key: 'device', label: 'Equipo', required: false },
        { key: 'productImei', label: IMEI_OPTIONAL_LABEL, required: false },
        { key: 'amount', label: 'Precio', required: false },
        { key: 'currency', label: 'Moneda', required: false },
        { key: 'paymentMethod', label: 'Pago', required: false },
        { key: 'tradeIn', label: 'Canje', required: false },
        { key: 'seller', label: 'Vendedor', required: false },
        { key: 'status', label: 'Estado', required: false },
      ],
      onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[], source: 'excel' | 'text') => {
        const result = await importBackendRows(user, 'sales', rows, undefined, source);
        await after();
        return result;
      },
    };
  }
  return {
    title: 'Importar clientes',
    nouns: { one: 'cliente', many: 'clientes' },
    unrelatedNotice: 'Este archivo no parece tener clientes para importar.',
    fields: [
      { key: 'name', label: 'Nombre', required: true },
      { key: 'phone', label: 'Teléfono', required: false },
      { key: 'instagram', label: 'Instagram', required: false },
      { key: 'email', label: 'Email', required: false },
      { key: 'dni', label: 'DNI', required: false },
    ],
    onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[], source: 'excel' | 'text') => {
      const result = await importBackendRows(user, 'clients', rows, undefined, source);
      await after();
      return result;
    },
  };
}
